import fs from 'fs';
import os from 'os';
import path from 'path';
import nodemailer from 'nodemailer';
import pool, { getDBSchema } from '../../db/connection.js';
import { OUTBOUND_EMAIL_FROM_HEADER } from '../../lib/emailFrom.js';
import { wrapEmailHtml } from '../../lib/emailHtml.js';
import { sendOutboundMail } from '../../lib/outboundMail.js';

const FLORIST_ONE_DEFAULT_BASE_URL = 'https://www.floristone.com/api/rest';
const FLORIST_ONE_DEFAULT_PRODUCTS_PATH = '/flowershop/getproducts';
const FLORIST_ONE_DEFAULT_TOTAL_PATH = '/flowershop/gettotal';
const FLORIST_ONE_DEFAULT_PLACE_ORDER_PATH = '/flowershop/placeorder';
const FLORIST_ONE_DEFAULT_AUTHNET_PATH = '/flowershop/getauthorizenetkey';
const FLORIST_ONE_PRODUCTS_PAGE_SIZE = 48;
const FLORIST_ONE_MAX_PAGES_FOR_OCCASION = 6;
const SEND_FLOWER_TARGET_PREFIX_ERROR = 'Error, user have not fill out address.  Send to address is incomplete, street, city,zip, county';

let giftTransactionsTableReady = false;
let cachedRawEnvMap = null;

function toFiniteNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function toMoneyAmount(value) {
  return toFiniteNumber(value, 0).toFixed(2);
}

function formatDateForEmail(value) {
  if (!value) return '';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(d);
}

function cleanNullableText(raw) {
  if (raw == null) return null;
  const text = String(raw).trim();
  return text ? text : null;
}

function makeSendFlowerTraceId() {
  return `sf-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function maskOpaqueToken(value) {
  const text = cleanNullableText(value);
  if (!text) return null;
  if (text.length <= 10) return `${text.slice(0, 2)}***`;
  return `${text.slice(0, 4)}***${text.slice(-4)}`;
}

function summarizeAddressForLogs(address) {
  return {
    full_name: cleanNullableText(address?.full_name),
    city: cleanNullableText(address?.city),
    zip: cleanNullableText(address?.zip),
    country: cleanNullableText(address?.country),
    email: cleanNullableText(address?.email),
    phone_tail: cleanNullableText(address?.phone)?.replace(/\D/g, '').slice(-4) || null
  };
}

function logSendFlower(traceId, stage, details = null) {
  const prefix = `[sendFlower:${traceId}] ${stage}`;
  if (details == null) {
    console.warn(prefix);
    return;
  }
  console.warn(prefix, details);
}

function sqlIdent(columnName) {
  const raw = String(columnName || '').trim();
  if (!raw) return raw;
  if (/^[a-z][a-z0-9_]*$/.test(raw)) return raw;
  const escaped = raw.replace(/"/g, '""');
  return `"${escaped}"`;
}

function pickColumn(existingColumns, candidates) {
  for (const candidate of candidates) {
    if (existingColumns.has(candidate)) return candidate;
  }
  return null;
}

async function getTableColumns(client, tableName) {
  const schema = getDBSchema();
  const colRes = await client.query(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = $1
       AND table_name = $2`,
    [schema, tableName]
  );
  return new Set((colRes.rows || []).map((r) => String(r.column_name || '').trim()).filter(Boolean));
}

async function getTableColumnTypeMap(client, tableName) {
  const schema = getDBSchema();
  const colRes = await client.query(
    `SELECT column_name, data_type, udt_name
     FROM information_schema.columns
     WHERE table_schema = $1
       AND table_name = $2`,
    [schema, tableName]
  );
  const typeMap = new Map();
  for (const row of colRes.rows || []) {
    const key = String(row?.column_name || '').trim();
    if (!key) continue;
    typeMap.set(key, {
      dataType: String(row?.data_type || '').trim().toLowerCase(),
      udtName: String(row?.udt_name || '').trim().toLowerCase()
    });
  }
  return typeMap;
}

function sanitizeValueForColumnType(columnType, value) {
  if (value == null) return null;
  const dataType = String(columnType?.dataType || '').toLowerCase();
  const udtName = String(columnType?.udtName || '').toLowerCase();
  const typeText = `${dataType}|${udtName}`;

  if (/smallint|int2|integer|int4|bigint|int8/.test(typeText)) {
    const n = Number(value);
    if (!Number.isFinite(n)) return null;
    return Math.trunc(n);
  }
  if (/numeric|decimal|real|double precision|float4|float8/.test(typeText)) {
    const n = Number(value);
    if (!Number.isFinite(n)) return null;
    return n;
  }
  if (/character|text|varchar|char/.test(typeText)) {
    return cleanNullableText(value);
  }
  if (/date/.test(typeText) && !/time/.test(typeText)) {
    if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.toISOString().slice(0, 10);
    return cleanNullableText(value);
  }
  // timestamps and other types can pass through as-is (Date objects supported by pg)
  return value;
}

function randomIntInclusive(min, max) {
  const lo = Math.ceil(min);
  const hi = Math.floor(max);
  return Math.floor(Math.random() * (hi - lo + 1)) + lo;
}

function makePaymentTransactionIdBigInt(paymentId) {
  const id = Math.trunc(toFiniteNumber(paymentId, 0));
  if (!Number.isFinite(id) || id < 1) return null;
  const prefix = String(randomIntInclusive(1, 99)).padStart(2, '0');
  const suffix = String(id % 1_000_000).padStart(6, '0');
  const combined = `${prefix}${suffix}`;
  const n = Number(combined);
  return Number.isFinite(n) ? n : null;
}

async function ensurePaymentTransactionId(client, paymentColumns, paymentId) {
  const paymentIdColumn = pickColumn(paymentColumns, ['payment_id']);
  const transactionIdColumn = pickColumn(paymentColumns, ['transactionId', 'transaction_id']);
  if (!paymentIdColumn || !transactionIdColumn) return null;
  const pid = Math.trunc(toFiniteNumber(paymentId, 0));
  if (!Number.isFinite(pid) || pid < 1) return null;

  const paymentIdSql = sqlIdent(paymentIdColumn);
  const transactionIdSql = sqlIdent(transactionIdColumn);

  const existing = await client.query(
    `SELECT ${transactionIdSql} AS transaction_id
     FROM helloworldjunktest.payment
     WHERE ${paymentIdSql} = $1
     LIMIT 1`,
    [pid]
  );
  const current = existing.rows[0]?.transaction_id;
  if (current != null && String(current).trim() !== '') {
    const n = Number(current);
    return Number.isFinite(n) ? n : null;
  }

  const nextId = makePaymentTransactionIdBigInt(pid);
  if (!nextId) return null;
  await client.query(
    `UPDATE helloworldjunktest.payment
     SET ${transactionIdSql} = $1
     WHERE ${paymentIdSql} = $2`,
    [nextId, pid]
  );
  return nextId;
}

function maskPhone(raw) {
  const text = cleanNullableText(raw);
  if (!text) return '';
  const digits = text.replace(/\D/g, '');
  if (digits.length < 4) return text;
  const tail = digits.slice(-4);
  return `***-***-${tail}`;
}

function composeAddressLabel(profile) {
  const first = cleanNullableText(profile?.mailing_firstname) || '';
  const last = cleanNullableText(profile?.mailing_lastname) || '';
  const fullName = `${first} ${last}`.trim();
  const street = cleanNullableText(profile?.mailing_street) || '';
  const city = cleanNullableText(profile?.mailing_city) || '';
  const zip = cleanNullableText(profile?.mailing_zip) || '';
  const country = cleanNullableText(profile?.mailing_country) || '';
  const location = [city, zip, country].filter(Boolean).join(', ');
  return [fullName, street, location].filter(Boolean).join(' | ');
}

function toFlorisOneAddressPayload(profile) {
  const first = cleanNullableText(profile?.mailing_firstname);
  const last = cleanNullableText(profile?.mailing_lastname);
  return {
    first_name: first,
    last_name: last,
    full_name: [first, last].filter(Boolean).join(' ').trim() || null,
    street: cleanNullableText(profile?.mailing_street),
    city: cleanNullableText(profile?.mailing_city),
    zip: cleanNullableText(profile?.mailing_zip),
    country: cleanNullableText(profile?.mailing_country),
    email: cleanNullableText(profile?.email),
    phone: cleanNullableText(profile?.phone)
  };
}

function asSafeAddressForUi(address) {
  return {
    full_name: cleanNullableText(address?.full_name),
    street: cleanNullableText(address?.street),
    city: cleanNullableText(address?.city),
    zip: cleanNullableText(address?.zip),
    country: cleanNullableText(address?.country),
    email: cleanNullableText(address?.email),
    phone_masked: maskPhone(address?.phone)
  };
}

/** Sender address on setup — includes phone so the member can edit before placing an order. */
function asEditableSenderAddressForUi(address) {
  return {
    ...asSafeAddressForUi(address),
    phone: cleanNullableText(address?.phone)
  };
}

function parseSendFromAddressFromRequestBody(body) {
  const raw = body?.send_from_address;
  if (!raw || typeof raw !== 'object') return null;
  const first = cleanNullableText(raw.first_name);
  const last = cleanNullableText(raw.last_name);
  const full =
    cleanNullableText(raw.full_name) || [first, last].filter(Boolean).join(' ').trim() || null;
  const payload = {
    first_name: first,
    last_name: last,
    full_name: full,
    street: cleanNullableText(raw.street),
    city: cleanNullableText(raw.city),
    zip: cleanNullableText(raw.zip),
    country: cleanNullableText(raw.country),
    email: cleanNullableText(raw.email),
    phone: cleanNullableText(raw.phone)
  };
  const hasAny = Object.values(payload).some(Boolean);
  return hasAny ? payload : null;
}

function resolveSendFromAddress(senderProfile, body) {
  const base = toFlorisOneAddressPayload(senderProfile);
  const override = parseSendFromAddressFromRequestBody(body);
  if (!override) return base;
  return {
    ...base,
    ...override,
    full_name: override.full_name || base.full_name
  };
}

function getHomeEnvPath() {
  return path.join(os.homedir(), '.ssh', 'be', '.env');
}

function parseRawEnvMap() {
  if (cachedRawEnvMap) return cachedRawEnvMap;
  const map = new Map();
  const envPath = getHomeEnvPath();
  if (!fs.existsSync(envPath)) {
    cachedRawEnvMap = map;
    return map;
  }
  const raw = fs.readFileSync(envPath, 'utf8');
  const lines = raw.split(/\r?\n/);
  for (const line of lines) {
    const text = String(line || '').trim();
    if (!text || text.startsWith('#')) continue;
    const m = text.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*[:=]\s*(.*)$/);
    if (!m) continue;
    const key = m[1];
    const value = String(m[2] || '').trim();
    if (!value) continue;
    map.set(key, value);
  }
  cachedRawEnvMap = map;
  return map;
}

function getEnvValueByAliases(aliases) {
  const rawMap = parseRawEnvMap();
  for (const key of aliases) {
    const direct = process.env[key];
    if (cleanNullableText(direct)) return cleanNullableText(direct);
  }
  for (const key of aliases) {
    const exact = rawMap.get(key);
    if (cleanNullableText(exact)) return cleanNullableText(exact);
  }
  const lowered = new Map();
  for (const [k, v] of rawMap.entries()) lowered.set(String(k).toLowerCase(), v);
  for (const key of aliases) {
    const value = lowered.get(String(key).toLowerCase());
    if (cleanNullableText(value)) return cleanNullableText(value);
  }
  return null;
}

function getFlorisOneConfig() {
  const apiKey = getEnvValueByAliases([
    'FLORISTONE_API_Key',
    'florisOne_api_key',
    'florisOne_apiKey',
    'FLORISTONE_API_KEY',
    'FLORISTONE_APIKEY'
  ]);
  const password = getEnvValueByAliases([
    'FLORISTONE_PASSWORD',
    'florisOne_password',
    'florisOne_pass',
    'FLORISTONE_PASS'
  ]);
  const baseUrl =
    getEnvValueByAliases(['florisOne_base_url', 'florisOne_baseUrl', 'FLORISTONE_BASE_URL']) || FLORIST_ONE_DEFAULT_BASE_URL;
  const productsPath =
    getEnvValueByAliases(['florisOne_products_path', 'florisOne_getproducts_path', 'FLORISTONE_PRODUCTS_PATH']) ||
    FLORIST_ONE_DEFAULT_PRODUCTS_PATH;
  const totalPath =
    getEnvValueByAliases(['florisOne_gettotal_path', 'florisOne_total_path', 'FLORISTONE_TOTAL_PATH']) ||
    FLORIST_ONE_DEFAULT_TOTAL_PATH;
  const placeOrderPath =
    getEnvValueByAliases(['florisOne_placeorder_path', 'florisOne_place_order_path', 'FLORISTONE_PLACE_ORDER_PATH']) ||
    FLORIST_ONE_DEFAULT_PLACE_ORDER_PATH;
  const authorizenetKeyPath =
    getEnvValueByAliases(['florisOne_authorizenet_key_path', 'florisOne_getauthorizenetkey_path', 'FLORISTONE_AUTHNET_KEY_PATH']) ||
    FLORIST_ONE_DEFAULT_AUTHNET_PATH;

  return {
    apiKey,
    password,
    baseUrl: String(baseUrl || '').trim().replace(/\/+$/, ''),
    productsPath: productsPath.startsWith('/') ? productsPath : `/${productsPath}`,
    totalPath: totalPath.startsWith('/') ? totalPath : `/${totalPath}`,
    placeOrderPath: placeOrderPath.startsWith('/') ? placeOrderPath : `/${placeOrderPath}`,
    authorizenetKeyPath: authorizenetKeyPath.startsWith('/') ? authorizenetKeyPath : `/${authorizenetKeyPath}`
  };
}

function makeFlorisOneAuthHeader(config) {
  const encoded = Buffer.from(`${config.apiKey}:${config.password}`, 'utf8').toString('base64');
  return `Basic ${encoded}`;
}

async function callFlorisOne(config, routePath, params, options = {}) {
  const url = new URL(`${config.baseUrl}${routePath}`);
  const method = String(options.method || 'GET').toUpperCase();
  const jsonBody = options.jsonBody && typeof options.jsonBody === 'object' ? options.jsonBody : null;
  if (method === 'GET') {
    Object.entries(params || {}).forEach(([key, value]) => {
      const clean = cleanNullableText(value);
      if (clean != null) url.searchParams.set(key, clean);
    });
  }

  const headers = {
    Authorization: makeFlorisOneAuthHeader(config),
    Accept: 'application/json'
  };
  if (jsonBody) headers['Content-Type'] = 'application/json; charset=utf-8';

  const response = await fetch(url.toString(), {
    method,
    headers,
    body: jsonBody ? JSON.stringify(jsonBody) : undefined
  });

  const rawBody = await response.text();
  let parsed = null;
  try {
    parsed = rawBody ? JSON.parse(rawBody) : null;
  } catch {
    parsed = null;
  }
  if (!response.ok) {
    const message = cleanNullableText(parsed?.message) || cleanNullableText(parsed?.error) || rawBody || 'FlorisOne API request failed';
    const err = new Error(message);
    err.statusCode = response.status;
    err.responseBody = parsed || rawBody;
    throw err;
  }
  return parsed || { raw: rawBody };
}

function normalizeFlorisOneProducts(result) {
  const candidateArrays = [
    result?.products,
    result?.PRODUCTS,
    result?.data?.products,
    result?.data?.PRODUCTS,
    result?.result?.products,
    result?.result?.PRODUCTS,
    result?.items,
    result?.data
  ].filter(Array.isArray);
  const list = candidateArrays[0] || [];
  return list
    .map((item) => {
      const productId =
        cleanNullableText(item?.code) ||
        cleanNullableText(item?.CODE) ||
        cleanNullableText(item?.productid) ||
        cleanNullableText(item?.product_id) ||
        cleanNullableText(item?.id);
      if (!productId) return null;
      const title =
        cleanNullableText(item?.name) ||
        cleanNullableText(item?.NAME) ||
        cleanNullableText(item?.product) ||
        cleanNullableText(item?.description) ||
        cleanNullableText(item?.DESCRIPTION) ||
        `Product ${productId}`;
      const amountValue = Number(item?.price ?? item?.PRICE ?? item?.amount ?? item?.price_total ?? NaN);
      return {
        product_id: productId,
        title,
        amount: Number.isFinite(amountValue) ? amountValue : null,
        image_url: cleanNullableText(item?.image) || cleanNullableText(item?.IMAGE) || cleanNullableText(item?.image_url) || cleanNullableText(item?.SMALL) || null,
        raw: item
      };
    })
    .filter(Boolean);
}

const OCCASION_KEYWORDS = {
  anniversary: ['anniversary'],
  birthday: ['birthday', 'bday'],
  sympathy: ['sympathy', 'funeral'],
  love: ['love', 'romance', 'romantic'],
  getwell: ['get well', 'well'],
  thankyou: ['thank', 'thanks'],
  congratulations: ['congrat', 'new baby'],
  autumn: ['autumn', 'fall'],
  christmas: ['christmas', 'holiday', 'xmas']
};
const OCCASION_CATEGORY_CODES = {
  bestsellers: 'bs',
  all: 'ao',
  everyday: 'ao',
  birthday: 'bd',
  valentines: 'vd',
  getwell: 'gw',
  sympathy: 'sy',
  congratulations: 'nb',
  thankyou: 'ty',
  anniversary: 'an',
  love: 'lr',
  easter: 'ea',
  christmas: 'cm',
  mothersday: 'md'
};
const PRODUCT_TYPE_CATEGORY_CODES = {
  centerpieces: 'c',
  onesided: 'o',
  mixed: 'v',
  roses: 'r',
  baskets: 'x',
  plants: 'p',
  balloons: 'b',
  funeralbestsellers: 'fbs',
  funeraltable: 'fa',
  funeralbaskets: 'fb',
  funeralsprays: 'fs',
  funeralplants: 'fp',
  funeralinsidecasket: 'fl',
  funeralwreaths: 'fw',
  funeralhearts: 'fh',
  funeralcrosses: 'fx',
  funeralcasketsprays: 'fc',
  funeralurn: 'fu',
  allproducts: 'all'
};
const PRICE_RANGE_CATEGORY_CODES = {
  u60: 'u60',
  '60t80': '60t80',
  '80t100': '80t100',
  a100: 'a100',
  fu60: 'fu60',
  f60t80: 'f60t80',
  f80t100: 'f80t100',
  fa100: 'fa100',
  // Backward-compatible aliases used in FE before docs alignment.
  under50: 'u60',
  '50to75': '60t80',
  '75to100': '80t100',
  over100: 'a100'
};

function normalizeOccasion(rawOccasion) {
  const text = String(rawOccasion || '').trim().toLowerCase();
  return text || 'all';
}

function productMatchesOccasion(item, occasion) {
  const key = normalizeOccasion(occasion);
  if (key === 'all') return true;
  const keywords = OCCASION_KEYWORDS[key] || [];
  if (!keywords.length) return true;
  const haystack = `${item?.title || ''} ${item?.product_id || ''}`.toLowerCase();
  return keywords.some((kw) => haystack.includes(String(kw).toLowerCase()));
}

function dedupeProductsById(products) {
  const list = Array.isArray(products) ? products : [];
  const seen = new Set();
  const deduped = [];
  for (const item of list) {
    const key = String(item?.product_id || '').trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    deduped.push(item);
  }
  return deduped;
}

function getCategoryCodeForOccasion(occasion) {
  const key = normalizeOccasion(occasion);
  return OCCASION_CATEGORY_CODES[key] || 'ao';
}

const PRODUCT_TYPE_KEYWORDS = {
  roses: ['rose', 'roses'],
  plants: ['plant', 'orchid', 'succulent'],
  baskets: ['basket', 'fruit'],
  balloons: ['balloon', 'balloons'],
  mixed: ['vase', 'arrangement', 'mixed'],
  centerpieces: ['centerpiece'],
  onesided: ['one sided', 'one-sided']
};

function productMatchesType(item, productType) {
  const key = String(productType || '').trim().toLowerCase();
  if (!key || key === 'all') return true;
  const keywords = PRODUCT_TYPE_KEYWORDS[key] || [];
  if (!keywords.length) return true;
  const haystack = `${item?.title || ''} ${item?.product_id || ''}`.toLowerCase();
  return keywords.some((kw) => haystack.includes(String(kw).toLowerCase()));
}

function productMatchesPriceRange(item, priceRange) {
  const key = String(priceRange || '').trim().toLowerCase();
  if (!key || key === 'all') return true;
  const amount = Number(item?.amount);
  if (!Number.isFinite(amount)) return false;
  if (key === 'u60' || key === 'under50') return amount < 60;
  if (key === '60t80' || key === '50to75') return amount >= 60 && amount <= 80;
  if (key === '80t100' || key === '75to100') return amount > 80 && amount <= 100;
  if (key === 'a100' || key === 'over100') return amount > 100;
  return true;
}

async function fetchCatalogProductsByCategory({ florisConfig, categoryCode, maxPages }) {
  const pageSize = FLORIST_ONE_PRODUCTS_PAGE_SIZE;
  const merged = [];
  for (let pageIndex = 0; pageIndex < maxPages; pageIndex += 1) {
    const start = String(pageIndex * pageSize + 1);
    const productResult = await callFlorisOne(florisConfig, florisConfig.productsPath, {
      category: String(categoryCode || 'ao'),
      count: String(pageSize),
      start
    });
    const pageProducts = normalizeFlorisOneProducts(productResult);
    if (!pageProducts.length) break;
    merged.push(...pageProducts);
    if (pageProducts.length < pageSize) break;
  }
  return dedupeProductsById(merged);
}

async function getSinglesAddressPair(client, senderSinglesId, recipientSinglesId) {
  const result = await client.query(
    `SELECT
       singles_id,
       prefix,
       member_id,
       alias,
       email,
       phone,
       mailing_firstname,
       mailing_lastname,
       mailing_street,
       mailing_city,
       mailing_zip,
       mailing_country
     FROM helloworldjunktest.singles
     WHERE singles_id IN ($1, $2)`,
    [senderSinglesId, recipientSinglesId]
  );
  const sender = result.rows.find((x) => Number(x.singles_id) === Number(senderSinglesId)) || null;
  const recipient = result.rows.find((x) => Number(x.singles_id) === Number(recipientSinglesId)) || null;
  return { sender, recipient };
}

async function getSinglesById(client, singlesId) {
  const result = await client.query(
    `SELECT
       singles_id,
       prefix,
       member_id,
       alias,
       email,
       phone,
       mailing_firstname,
       mailing_lastname,
       mailing_street,
       mailing_city,
       mailing_zip,
       mailing_country
     FROM helloworldjunktest.singles
     WHERE singles_id = $1
     LIMIT 1`,
    [singlesId]
  );
  return result.rows[0] || null;
}

function enforceRecipientPrefixRule(sender, recipient) {
  const senderPrefix = Number(sender?.prefix);
  const bypassTargetPrefixCheck = Number.isFinite(senderPrefix) && senderPrefix !== 0;
  if (bypassTargetPrefixCheck) return;
  const prefix = Number(recipient?.prefix);
  if (Number.isFinite(prefix) && prefix === 0) return;
  const err = new Error(SEND_FLOWER_TARGET_PREFIX_ERROR);
  err.statusCode = 400;
  throw err;
}

function validateAddressComplete(label, address) {
  const missing = [];
  if (!cleanNullableText(address?.full_name)) missing.push('full_name');
  if (!cleanNullableText(address?.street)) missing.push('street');
  if (!cleanNullableText(address?.city)) missing.push('city');
  if (!cleanNullableText(address?.zip)) missing.push('zip');
  if (!cleanNullableText(address?.country)) missing.push('country');
  if (!cleanNullableText(address?.phone)) missing.push('phone');
  if (missing.length) {
    const msg = `${label} address is incomplete: ${missing.join(', ')}`;
    const err = new Error(msg);
    err.statusCode = 400;
    throw err;
  }
}

function extractFlorisOrderId(result) {
  return (
    cleanNullableText(result?.orderid) ||
    cleanNullableText(result?.order_id) ||
    cleanNullableText(result?.id) ||
    cleanNullableText(result?.data?.orderid) ||
    cleanNullableText(result?.data?.order_id) ||
    null
  );
}

function parseMoneyLikeValue(rawValue) {
  if (rawValue == null) return null;
  if (typeof rawValue === 'number') return Number.isFinite(rawValue) ? rawValue : null;
  if (typeof rawValue === 'string') {
    const cleaned = rawValue.trim();
    if (!cleaned) return null;
    const normalized = cleaned.replace(/,/g, '');
    const direct = Number(normalized);
    if (Number.isFinite(direct)) return direct;
    const match = normalized.match(/-?\d+(?:\.\d+)?/);
    if (!match) return null;
    const parsed = Number(match[0]);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function extractAmountFromFlorisTotal(result) {
  const candidates = [
    result?.total,
    result?.TOTAL,
    result?.amount,
    result?.AMOUNT,
    result?.order_total,
    result?.ORDER_TOTAL,
    result?.ordertotal,
    result?.ORDERTOTAL,
    result?.grand_total,
    result?.GRAND_TOTAL,
    result?.grandtotal,
    result?.GRANDTOTAL,
    result?.total_price,
    result?.TOTAL_PRICE,
    result?.totalprice,
    result?.TOTALPRICE,
    result?.data?.total,
    result?.data?.TOTAL,
    result?.data?.amount,
    result?.data?.AMOUNT,
    result?.data?.order_total,
    result?.data?.ORDER_TOTAL,
    result?.data?.ordertotal,
    result?.data?.ORDERTOTAL,
    result?.result?.total,
    result?.result?.TOTAL,
    result?.result?.amount,
    result?.result?.AMOUNT,
    result?.result?.order_total,
    result?.result?.ORDER_TOTAL,
    result?.result?.ordertotal,
    result?.result?.ORDERTOTAL
  ];
  for (const value of candidates) {
    const parsed = parseMoneyLikeValue(value);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return null;
}

function extractFlorisValidationErrors(result) {
  const errors = [];
  const pushValue = (value) => {
    const text = cleanNullableText(value);
    if (text) errors.push(text);
  };
  const append = (value) => {
    if (!value) return;
    if (Array.isArray(value)) {
      value.forEach(append);
      return;
    }
    if (typeof value === 'string' || typeof value === 'number') {
      pushValue(value);
      return;
    }
    if (typeof value === 'object') {
      pushValue(value?.message);
      pushValue(value?.error);
      pushValue(value?.field);
    }
  };
  append(result?.errors);
  append(result?.error);
  append(result?.errors_detailed);
  append(result?.data?.errors);
  append(result?.data?.error);
  append(result?.result?.errors);
  append(result?.result?.error);
  return Array.from(new Set(errors));
}

function isMissingProductsTotalError(result) {
  const issues = extractFlorisValidationErrors(result);
  return issues.some((issue) => /products?\s+obj\s+undefined/i.test(issue));
}

function isMissingPlaceOrderFieldError(errorText) {
  const text = String(errorText || '').toLowerCase();
  if (!text) return false;
  return (
    text.includes('product price is required') ||
    text.includes('products obj undefined') ||
    text.includes('product code is required') ||
    text.includes('recipient')
  );
}

function toCountryCode(rawCountry) {
  const text = String(rawCountry || '').trim().toUpperCase();
  if (text === 'US' || text === 'USA' || text === 'UNITED STATES') return 'US';
  if (text === 'CA' || text === 'CANADA') return 'CA';
  return 'US';
}

function toSafeStateCode(rawState) {
  const text = String(rawState || '').trim().toUpperCase();
  if (/^[A-Z]{2}$/.test(text)) return text;
  return 'CA';
}

function firstForwardedIp(rawValue) {
  const text = cleanNullableText(rawValue);
  if (!text) return null;
  return cleanNullableText(String(text).split(',')[0]);
}

function isSmtpConfiguredForMail() {
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = String(process.env.SMTP_PASS || '').replace(/\s+/g, '');
  return Boolean(
    smtpUser &&
      smtpPass &&
      smtpUser !== 'your-email@gmail.com' &&
      smtpPass !== 'your-app-password'
  );
}

function escapeHtml(raw) {
  return String(raw ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function sendGiftNotificationEmailsFireAndForget({
  sender,
  recipient,
  amountPaid,
  productId,
  orderDate,
  expectedDeliveryDate
}) {
  if (!isSmtpConfiguredForMail()) {
    console.warn('[sendFlower:mail] SMTP not configured; skipping notifications');
    return;
  }
  const senderEmail = cleanNullableText(sender?.email);
  const recipientEmail = cleanNullableText(recipient?.email);
  if (!senderEmail && !recipientEmail) return;

  const smtpUser = process.env.SMTP_USER;
  const smtpPass = String(process.env.SMTP_PASS || '').replace(/\s+/g, '');
  const smtpHost = process.env.SMTP_HOST || 'smtp.gmail.com';
  const smtpPortNum = parseInt(process.env.SMTP_PORT, 10) || 587;
  const orderDay = formatDateForEmail(orderDate || new Date());
  const arriveDay = formatDateForEmail(expectedDeliveryDate) || 'Soon';
  const amountLabel = Number.isFinite(Number(amountPaid)) ? `$${toMoneyAmount(amountPaid)}` : 'N/A';
  const senderMemberId = sender?.member_id ?? 'unknown';
  const recipientMemberId = recipient?.member_id ?? 'unknown';
  const commonPrivacyNote =
    'For your safety and privacy, names and addresses are never shared in this message or with the other member.';

  const senderHtml = wrapEmailHtml(
    `
      <h2 style="color:#222;">Your flower gift is on the way</h2>
      <p style="line-height:1.5;color:#333;">
        A sweet gesture has been sent from member_id <strong>${escapeHtml(senderMemberId)}</strong> to member_id
        <strong>${escapeHtml(recipientMemberId)}</strong>.
      </p>
      <p style="line-height:1.5;color:#333;">
        Sometimes a flower says what words cannot. Your thoughtful gift is a beautiful way to show genuine attraction and care.
      </p>
      <p style="line-height:1.5;color:#333;">
        Order date: <strong>${escapeHtml(orderDay)}</strong><br />
        Expected arrival: <strong>${escapeHtml(arriveDay)}</strong><br />
        Product: <strong>${escapeHtml(productId || 'N/A')}</strong><br />
        Amount: <strong>${escapeHtml(amountLabel)}</strong>
      </p>
      <p style="line-height:1.5;color:#666;">${escapeHtml(commonPrivacyNote)}</p>
    `,
    { maxWidth: '700px' }
  );

  const recipientHtml = wrapEmailHtml(
    `
      <h2 style="color:#222;">A flower gift was sent to you</h2>
      <p style="line-height:1.5;color:#333;">
        A romantic flower gift has been sent from member_id <strong>${escapeHtml(senderMemberId)}</strong> to member_id
        <strong>${escapeHtml(recipientMemberId)}</strong>.
      </p>
      <p style="line-height:1.5;color:#333;">
        A thoughtful flower can be a gentle spark of attraction and kindness. We hope this brings a warm smile to your day.
      </p>
      <p style="line-height:1.5;color:#333;">
        Order date: <strong>${escapeHtml(orderDay)}</strong><br />
        Expected arrival: <strong>${escapeHtml(arriveDay)}</strong>
      </p>
      <p style="line-height:1.5;color:#666;">${escapeHtml(commonPrivacyNote)}</p>
    `,
    { maxWidth: '700px' }
  );

  void (async () => {
    try {
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPortNum,
        secure: false,
        auth: { user: smtpUser, pass: smtpPass }
      });
      const jobs = [];
      if (senderEmail) {
        jobs.push(
          sendOutboundMail(transporter, {
            from: OUTBOUND_EMAIL_FROM_HEADER,
            to: senderEmail,
            subject: 'Your flower gift is on the way',
            html: senderHtml
          })
        );
      }
      if (recipientEmail) {
        jobs.push(
          sendOutboundMail(transporter, {
            from: OUTBOUND_EMAIL_FROM_HEADER,
            to: recipientEmail,
            subject: 'A flower gift has been sent to you',
            html: recipientHtml
          })
        );
      }
      await Promise.all(jobs);
    } catch (err) {
      console.error('[sendFlower:mail] sendMail failed:', err?.message || err);
    }
  })();
}

async function createGiftPaymentHistoryRow(client, { singlesId, recipient, productId, amountPaid, floristOrderId, deliveryDate, traceId = 'n/a' }) {
  logSendFlower(traceId, 'createGiftPaymentHistoryRow:start', {
    singlesId,
    recipientMemberId: recipient?.member_id ?? null,
    productId,
    amountPaid,
    floristOrderId: cleanNullableText(floristOrderId),
    deliveryDate: cleanNullableText(deliveryDate)
  });
  if (!Number.isFinite(Number(amountPaid)) || Number(amountPaid) <= 0) {
    logSendFlower(traceId, 'createGiftPaymentHistoryRow:skip', { reason: 'amountPaid missing or non-positive', amountPaid });
    return { paymentId: null, transactionId: null };
  }
  const paymentColumns = await getTableColumns(client, 'payment');
  const paymentColumnTypes = await getTableColumnTypeMap(client, 'payment');
  const singlesColumns = await getTableColumns(client, 'singles');

  const latestPaymentResult = await client.query(
    `SELECT payment_id, account_balance_token, paid_total_dollar, token_add_or_debit
     FROM helloworldjunktest.payment
     WHERE singles_id = $1
     ORDER BY payment_id DESC
     LIMIT 1`,
    [singlesId]
  );
  const latestPayment = latestPaymentResult.rows[0] || {};
  const prevBalance = toFiniteNumber(latestPayment?.account_balance_token, 0);
  const prevPaidDollar = toFiniteNumber(latestPayment?.paid_total_dollar, 0);
  const prevTokenTotal = toFiniteNumber(latestPayment?.token_add_or_debit, 0);
  const nextPaidDollar = prevPaidDollar + Number(amountPaid);
  const now = new Date();
  const recipientMemberId = recipient?.member_id == null ? '' : String(recipient.member_id);
  const expectedDateText = formatDateForEmail(deliveryDate);
  const description = `Flower gift sent to member ${recipientMemberId || 'unknown'}: $${toMoneyAmount(
    amountPaid
  )}, product ${productId}${floristOrderId ? `, florist order ${floristOrderId}` : ''}${
    expectedDateText ? `, expected ${expectedDateText}` : ''
  }`;

  const insertColumns = [];
  const insertValues = [];
  const placeholders = [];
  const pushIfExists = (column, value) => {
    if (!paymentColumns.has(column) || insertColumns.includes(column)) return;
    const sanitized = sanitizeValueForColumnType(paymentColumnTypes.get(column), value);
    if (sanitized == null && value != null) {
      logSendFlower(traceId, 'createGiftPaymentHistoryRow:value-sanitized-null', {
        column,
        incoming: value,
        columnType: paymentColumnTypes.get(column) || null
      });
    }
    insertColumns.push(column);
    insertValues.push(sanitized);
    placeholders.push(`$${insertValues.length}`);
  };
  pushIfExists('singles_id', singlesId);
  pushIfExists('payment_history', description);
  pushIfExists('transaction_description', description);
  pushIfExists('account_balance_token', prevBalance);
  pushIfExists('paid_total_dollar', nextPaidDollar);
  pushIfExists('token_add_or_debit', prevTokenTotal);
  pushIfExists('transaction_date_time', now);
  pushIfExists('last_paid_date', now);
  if (paymentColumns.has('created_at')) {
    insertColumns.push('created_at');
    placeholders.push('CURRENT_TIMESTAMP');
  }
  if (paymentColumns.has('updated_at')) {
    insertColumns.push('updated_at');
    placeholders.push('CURRENT_TIMESTAMP');
  }
  if (!insertColumns.length) {
    logSendFlower(traceId, 'createGiftPaymentHistoryRow:skip', { reason: 'no writable payment columns' });
    return { paymentId: null, transactionId: null };
  }
  logSendFlower(traceId, 'createGiftPaymentHistoryRow:insert', {
    insertColumns,
    valuesCount: insertValues.length,
    paymentColumnTypes: Object.fromEntries(paymentColumnTypes)
  });

  const inserted = await client.query(
    `INSERT INTO helloworldjunktest.payment (${insertColumns.join(', ')})
     VALUES (${placeholders.join(', ')})
     RETURNING payment_id`,
    insertValues
  );
  const paymentId = Number(inserted.rows[0]?.payment_id);
  const transactionId = await ensurePaymentTransactionId(client, paymentColumns, paymentId);
  logSendFlower(traceId, 'createGiftPaymentHistoryRow:inserted', { paymentId, transactionId });

  if (Number.isFinite(paymentId) && paymentId > 0 && singlesColumns.has('payment_id_fk')) {
    const updates = ['payment_id_fk = $1'];
    if (singlesColumns.has('updated_at')) updates.push('updated_at = CURRENT_TIMESTAMP');
    await client.query(
      `UPDATE helloworldjunktest.singles
       SET ${updates.join(', ')}
       WHERE singles_id = $2`,
      [paymentId, singlesId]
    );
  }
  logSendFlower(traceId, 'createGiftPaymentHistoryRow:done', { paymentId, transactionId });
  return { paymentId, transactionId };
}

async function ensureGiftTransactionsTable(client) {
  if (giftTransactionsTableReady) return;
  const schema = sqlIdent(getDBSchema());
  await client.query(
    `CREATE TABLE IF NOT EXISTS ${schema}.gift_transactions (
       id BIGSERIAL PRIMARY KEY,
       singles_id BIGINT,
       recipient_id BIGINT,
       product_id VARCHAR(80) NOT NULL,
       amount_paid NUMERIC(12,2),
       status VARCHAR(40) NOT NULL DEFAULT 'pending_address',
       delivery_date DATE,
       card_message TEXT,
       send_to_address TEXT NOT NULL DEFAULT '',
       send_from_address TEXT NOT NULL DEFAULT '',
       florist_order_id VARCHAR(120),
       florist_response_json JSONB,
       created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
     )`
  );

  let cols = await getTableColumns(client, 'gift_transactions');
  if (!cols.has('singles_id')) {
    await client.query(`ALTER TABLE ${schema}.gift_transactions ADD COLUMN IF NOT EXISTS singles_id BIGINT`);
    cols = await getTableColumns(client, 'gift_transactions');
    if (cols.has('sender_id')) {
      await client.query(`UPDATE ${schema}.gift_transactions SET singles_id = sender_id WHERE singles_id IS NULL`);
    }
  }
  if (!cols.has('recipient_id')) {
    await client.query(`ALTER TABLE ${schema}.gift_transactions ADD COLUMN IF NOT EXISTS recipient_id BIGINT`);
    cols = await getTableColumns(client, 'gift_transactions');
    if (cols.has('receiver_id')) {
      await client.query(`UPDATE ${schema}.gift_transactions SET recipient_id = receiver_id WHERE recipient_id IS NULL`);
    }
  }
  if (!cols.has('created_at')) {
    await client.query(
      `ALTER TABLE ${schema}.gift_transactions
       ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP`
    );
  }
  if (!cols.has('send_to_address')) {
    await client.query(`ALTER TABLE ${schema}.gift_transactions ADD COLUMN IF NOT EXISTS send_to_address TEXT NOT NULL DEFAULT ''`);
  }
  if (!cols.has('send_from_address')) {
    await client.query(`ALTER TABLE ${schema}.gift_transactions ADD COLUMN IF NOT EXISTS send_from_address TEXT NOT NULL DEFAULT ''`);
  }
  if (!cols.has('delivery_date')) {
    await client.query(`ALTER TABLE ${schema}.gift_transactions ADD COLUMN IF NOT EXISTS delivery_date DATE`);
  }
  if (!cols.has('card_message')) {
    await client.query(`ALTER TABLE ${schema}.gift_transactions ADD COLUMN IF NOT EXISTS card_message TEXT`);
  }
  if (!cols.has('florist_order_id')) {
    await client.query(`ALTER TABLE ${schema}.gift_transactions ADD COLUMN IF NOT EXISTS florist_order_id VARCHAR(120)`);
  }
  if (!cols.has('florist_response_json')) {
    await client.query(`ALTER TABLE ${schema}.gift_transactions ADD COLUMN IF NOT EXISTS florist_response_json JSONB`);
  }

  cols = await getTableColumns(client, 'gift_transactions');
  if (cols.has('delivery_address') && cols.has('send_to_address')) {
    await client.query(
      `UPDATE ${schema}.gift_transactions
       SET send_to_address = delivery_address
       WHERE COALESCE(send_to_address, '') = ''
         AND COALESCE(delivery_address, '') <> ''`
    );
  }
  if (cols.has('sender_id') && cols.has('singles_id')) {
    await client.query(`UPDATE ${schema}.gift_transactions SET singles_id = sender_id WHERE singles_id IS NULL`);
  }
  if (cols.has('florist_one_order_id') && cols.has('florist_order_id')) {
    await client.query(
      `UPDATE ${schema}.gift_transactions
       SET florist_order_id = florist_one_order_id
       WHERE COALESCE(florist_order_id, '') = ''
         AND COALESCE(florist_one_order_id, '') <> ''`
    );
  }

  cols = await getTableColumns(client, 'gift_transactions');
  if (cols.has('singles_id') && cols.has('created_at')) {
    await client.query(`CREATE INDEX IF NOT EXISTS gift_transactions_singles_idx ON ${schema}.gift_transactions(singles_id, created_at DESC)`);
  }
  if (cols.has('recipient_id') && cols.has('created_at')) {
    await client.query(`CREATE INDEX IF NOT EXISTS gift_transactions_recipient_idx ON ${schema}.gift_transactions(recipient_id, created_at DESC)`);
  }
  giftTransactionsTableReady = true;
}

async function insertGiftTransaction(client, payload) {
  await ensureGiftTransactionsTable(client);
  const schema = sqlIdent(getDBSchema());
  const traceId = cleanNullableText(payload?.trace_id) || 'n/a';
  const safeSinglesId = Number.isFinite(Number(payload?.singles_id)) ? Number(payload.singles_id) : null;
  const safeRecipientId = Number.isFinite(Number(payload?.recipient_id)) ? Number(payload.recipient_id) : null;
  const safeAmountPaid = Number.isFinite(Number(payload?.amount_paid)) ? Number(payload.amount_paid) : null;
  const safeDeliveryDate = cleanNullableText(payload?.delivery_date);
  const safeCardMessage = cleanNullableText(payload?.card_message);
  const safeSendToAddress = cleanNullableText(payload?.send_to_address) || '';
  const safeSendFromAddress = cleanNullableText(payload?.send_from_address) || '';
  const safeFloristOrderId = cleanNullableText(payload?.florist_order_id);
  const safeProductId = cleanNullableText(payload?.product_id) || 'unknown';
  const safeStatus = cleanNullableText(payload?.status) || 'pending_address';
  const insert = await client.query(
    `INSERT INTO ${schema}.gift_transactions
      (singles_id, recipient_id, product_id, amount_paid, status, delivery_date, card_message, send_to_address, send_from_address, florist_order_id, florist_response_json)
     VALUES
      ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb)
     RETURNING id, singles_id, recipient_id, product_id, amount_paid, status, delivery_date, card_message, send_to_address, send_from_address, florist_order_id, created_at`,
    [
      safeSinglesId,
      safeRecipientId,
      safeProductId,
      safeAmountPaid,
      safeStatus,
      safeDeliveryDate,
      safeCardMessage,
      safeSendToAddress,
      safeSendFromAddress,
      safeFloristOrderId,
      JSON.stringify(payload.florist_response_json || null)
    ]
  );
  logSendFlower(traceId, 'insertGiftTransaction:inserted', {
    id: insert.rows[0]?.id ?? null,
    singles_id: safeSinglesId,
    recipient_id: safeRecipientId,
    product_id: safeProductId,
    amount_paid: safeAmountPaid,
    status: safeStatus
  });
  return insert.rows[0] || null;
}

async function getGiftTransactionsForSingles(client, singlesId, limit = 8) {
  await ensureGiftTransactionsTable(client);
  const schema = sqlIdent(getDBSchema());
  const safeLimit = Math.max(1, Math.min(30, Math.trunc(toFiniteNumber(limit, 8))));
  const result = await client.query(
    `SELECT
       gt.id,
       gt.singles_id,
       gt.recipient_id,
       gt.product_id,
       gt.amount_paid,
       gt.status,
       gt.delivery_date,
       gt.card_message,
       gt.florist_order_id,
       gt.created_at,
       s_from.member_id AS sender_member_id,
       s_to.member_id AS recipient_member_id
     FROM ${schema}.gift_transactions gt
     LEFT JOIN ${schema}.singles s_from ON s_from.singles_id = gt.singles_id
     LEFT JOIN ${schema}.singles s_to ON s_to.singles_id = gt.recipient_id
     WHERE gt.singles_id = $1
     ORDER BY gt.created_at DESC
     LIMIT $2`,
    [singlesId, safeLimit]
  );
  return result.rows || [];
}

export async function getSendFlowerSetup(req, res) {
  const traceId = makeSendFlowerTraceId();
  const senderSinglesId = Number(req.auth?.singles_id);
  logSendFlower(traceId, 'getSetup:start', {
    senderSinglesId,
    targetSinglesId: Number(req.query?.target_singles_id),
    ip: firstForwardedIp(req.headers['x-forwarded-for']) || cleanNullableText(req.ip) || null
  });
  if (!Number.isFinite(senderSinglesId) || senderSinglesId < 1) {
    logSendFlower(traceId, 'getSetup:auth-failed');
    return res.status(401).json({ error: 'Authentication required' });
  }
  const recipientSinglesId = Number(req.query?.target_singles_id);
  const occasion = normalizeOccasion(req.query?.occasion);
  const productType = String(req.query?.product_type || '').trim().toLowerCase() || 'all';
  const priceRange = String(req.query?.price_range || '').trim().toLowerCase() || 'all';
  const hasRecipientSinglesId = Number.isFinite(recipientSinglesId) && recipientSinglesId > 0;
  if (hasRecipientSinglesId && recipientSinglesId === senderSinglesId) {
    logSendFlower(traceId, 'getSetup:self-target');
    return res.status(400).json({ error: 'Cannot send flower to yourself' });
  }

  const client = await pool.connect();
  try {
    const sender = await getSinglesById(client, senderSinglesId);
    const recipient = hasRecipientSinglesId ? (await getSinglesById(client, recipientSinglesId)) : null;
    if (!sender) return res.status(404).json({ error: 'Sender profile not found' });
    if (hasRecipientSinglesId && !recipient) return res.status(404).json({ error: 'Recipient profile not found' });
    if (hasRecipientSinglesId) enforceRecipientPrefixRule(sender, recipient);

    const sendFromAddress = toFlorisOneAddressPayload(sender);
    const sendToAddress = recipient ? toFlorisOneAddressPayload(recipient) : null;
    logSendFlower(traceId, 'getSetup:addresses', {
      sendFrom: summarizeAddressForLogs(sendFromAddress),
      sendTo: summarizeAddressForLogs(sendToAddress)
    });
    validateAddressComplete('Send from', sendFromAddress);
    if (sendToAddress) validateAddressComplete('Send to', sendToAddress);

    const florisConfig = getFlorisOneConfig();
    logSendFlower(traceId, 'getSetup:floris-config', {
      baseUrl: florisConfig.baseUrl,
      productsPath: florisConfig.productsPath,
      hasApiKey: Boolean(florisConfig.apiKey),
      hasPassword: Boolean(florisConfig.password)
    });
    if (!florisConfig.apiKey || !florisConfig.password) {
      return res.status(500).json({ error: 'FlorisOne credentials are not configured' });
    }

    let products = [];
    let productsWarning = null;
    try {
      const mappedProductCategory = PRODUCT_TYPE_CATEGORY_CODES[productType] || null;
      const mappedPriceCategory = PRICE_RANGE_CATEGORY_CODES[priceRange] || null;
      const categoryCode = mappedPriceCategory || mappedProductCategory || getCategoryCodeForOccasion(occasion);
      const hasMappedOccasionCategory = Boolean(OCCASION_CATEGORY_CODES[occasion]);
      const hasMappedProductCategory = Boolean(mappedProductCategory);
      const hasMappedPriceCategory = Boolean(mappedPriceCategory);
      logSendFlower(traceId, 'getSetup:products-request', {
        occasion,
        productType,
        priceRange,
        category: categoryCode,
        hasMappedPriceCategory,
        hasMappedProductCategory,
        hasMappedOccasionCategory,
        locationScoped: false
      });

      const shouldFetchExtraPages = categoryCode !== 'ao' && categoryCode !== 'all';
      const maxPages = shouldFetchExtraPages ? FLORIST_ONE_MAX_PAGES_FOR_OCCASION : 1;
      let dedupedProducts = await fetchCatalogProductsByCategory({
        florisConfig,
        categoryCode,
        maxPages
      });

      // Safe fallback: if mapped category returns empty unexpectedly, fall back to all-occasion + keyword matching.
      let usedKeywordFallback = false;
      if (occasion !== 'all' && hasMappedOccasionCategory && !hasMappedProductCategory && !hasMappedPriceCategory && dedupedProducts.length === 0) {
        const allOccasionProducts = await fetchCatalogProductsByCategory({
          florisConfig,
          categoryCode: 'ao',
          maxPages
        });
        dedupedProducts = allOccasionProducts;
        usedKeywordFallback = true;
      }

      const shouldUseKeywordOccasionFallback =
        !hasMappedProductCategory && !hasMappedPriceCategory && ((occasion !== 'all' && !hasMappedOccasionCategory) || usedKeywordFallback);
      const occasionProducts = shouldUseKeywordOccasionFallback ? dedupedProducts.filter((item) => productMatchesOccasion(item, occasion)) : dedupedProducts;
      if (shouldUseKeywordOccasionFallback && occasionProducts.length === 0) {
        products = dedupedProducts;
        productsWarning = `No exact products matched "${occasion}" by keyword. Showing all available choices.`;
      } else if (hasMappedPriceCategory && dedupedProducts.length === 0) {
        const allOccasionProducts = await fetchCatalogProductsByCategory({
          florisConfig,
          categoryCode: 'ao',
          maxPages
        });
        const fallbackPrice = allOccasionProducts.filter((item) => productMatchesPriceRange(item, priceRange));
        products = fallbackPrice.length ? fallbackPrice : allOccasionProducts;
        productsWarning = `Category "${priceRange}" returned no direct results, using fallback catalog.`;
      } else if (hasMappedProductCategory && dedupedProducts.length === 0) {
        const allOccasionProducts = await fetchCatalogProductsByCategory({
          florisConfig,
          categoryCode: 'ao',
          maxPages
        });
        const fallbackByProductType = allOccasionProducts.filter((item) => productMatchesType(item, productType));
        products = fallbackByProductType.length ? fallbackByProductType : allOccasionProducts;
        productsWarning = `Category "${productType}" returned no direct results, using fallback catalog.`;
      } else if (usedKeywordFallback) {
        products = occasionProducts;
        productsWarning = `Category "${occasion}" returned no direct results, using keyword fallback.`;
      } else {
        products = occasionProducts;
      }

      logSendFlower(traceId, 'getSetup:products-response', {
        normalizedCount: Array.isArray(products) ? products.length : 0,
        fetchedRawCount: dedupedProducts.length,
        occasion
      });
      if (!products.length) {
        productsWarning = 'No products returned by FlorisOne for recipient location';
      }
    } catch (err) {
      logSendFlower(traceId, 'getSetup:products-failed', {
        message: err?.message || String(err),
        statusCode: err?.statusCode || null,
        responseBody: err?.responseBody || null
      });
      productsWarning = 'Could not load FlorisOne catalog right now';
    }

    logSendFlower(traceId, 'getSetup:success', {
      products_count: Array.isArray(products) ? products.length : 0,
      products_warning: productsWarning
    });
    return res.json({
      target_singles_id: hasRecipientSinglesId ? recipientSinglesId : null,
      sender: {
        singles_id: senderSinglesId,
        member_id: sender.member_id ?? null,
        alias: cleanNullableText(sender.alias),
        send_from_address: asEditableSenderAddressForUi(sendFromAddress)
      },
      recipient: recipient
        ? {
            singles_id: recipientSinglesId,
            member_id: recipient.member_id ?? null,
            alias: cleanNullableText(recipient.alias),
            send_to_address: asSafeAddressForUi(sendToAddress)
          }
        : null,
      products,
      products_count: Array.isArray(products) ? products.length : 0,
      products_warning: productsWarning
    });
  } catch (error) {
    const statusCode = Number(error?.statusCode) || 500;
    logSendFlower(traceId, 'getSetup:error', {
      statusCode,
      message: error?.message || String(error),
      stack: error?.stack || null
    });
    return res.status(statusCode).json({ error: error?.message || 'Failed to load send flower setup' });
  } finally {
    client.release();
  }
}

export async function getSendFlowerHistory(req, res) {
  const singlesId = Number(req.auth?.singles_id);
  if (!Number.isFinite(singlesId) || singlesId < 1) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  const limit = Number(req.query?.limit);
  const client = await pool.connect();
  try {
    const rows = await getGiftTransactionsForSingles(client, singlesId, Number.isFinite(limit) ? limit : 8);
    return res.json({
      rows: rows.map((row) => ({
        id: Number(row.id),
        singles_id: Number(row.singles_id),
        recipient_id: Number(row.recipient_id),
        sender_member_id: row.sender_member_id ?? null,
        recipient_member_id: row.recipient_member_id ?? null,
        product_id: cleanNullableText(row.product_id),
        amount_paid: row.amount_paid == null ? null : Number(row.amount_paid),
        status: cleanNullableText(row.status),
        delivery_date: row.delivery_date || null,
        florist_order_id: cleanNullableText(row.florist_order_id),
        created_at: row.created_at || null
      }))
    });
  } catch (error) {
    console.error('[sendFlower:getHistory]', error);
    return res.status(500).json({ error: 'Failed to load gift history' });
  } finally {
    client.release();
  }
}

export async function getSendFlowerAuthorizeNetKey(req, res) {
  const singlesId = Number(req.auth?.singles_id);
  if (!Number.isFinite(singlesId) || singlesId < 1) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  const florisConfig = getFlorisOneConfig();
  if (!florisConfig.apiKey || !florisConfig.password) {
    return res.status(500).json({ error: 'FlorisOne credentials are not configured' });
  }
  try {
    const result = await callFlorisOne(florisConfig, florisConfig.authorizenetKeyPath, {});
    const username = cleanNullableText(result?.USERNAME) || cleanNullableText(result?.username);
    const authKey = cleanNullableText(result?.AUTHORIZENET_KEY) || cleanNullableText(result?.authorizenet_key);
    const authUrl = cleanNullableText(result?.AUTHORIZENET_URL) || cleanNullableText(result?.authorizenet_url);
    if (!username || !authKey || !authUrl) {
      return res.status(502).json({ error: 'FlorisOne did not return full Authorize.Net key payload' });
    }
    return res.json({
      username,
      authorizenet_key: authKey,
      authorizenet_url: authUrl
    });
  } catch (error) {
    console.error('[sendFlower:getAuthorizeNetKey]', error);
    const statusCode = Number(error?.statusCode) || 502;
    return res.status(statusCode).json({ error: error?.message || 'Failed to get Authorize.Net key from FlorisOne' });
  }
}

export async function placeSendFlowerOrder(req, res) {
  const traceId = makeSendFlowerTraceId();
  const senderSinglesId = Number(req.auth?.singles_id);
  logSendFlower(traceId, 'placeOrder:start', {
    senderSinglesId,
    targetSinglesId: Number(req.body?.target_singles_id),
    productId: cleanNullableText(req.body?.product_id),
    deliveryDate: cleanNullableText(req.body?.delivery_date),
    hasAuthToken: Boolean(cleanNullableText(req.body?.authorizenet_token)),
    authTokenMasked: maskOpaqueToken(req.body?.authorizenet_token),
    productPriceRaw: req.body?.product_price ?? null
  });
  if (!Number.isFinite(senderSinglesId) || senderSinglesId < 1) {
    logSendFlower(traceId, 'placeOrder:auth-failed');
    return res.status(401).json({ error: 'Authentication required' });
  }
  const targetSinglesId = Number(req.body?.target_singles_id);
  const productId = cleanNullableText(req.body?.product_id);
  const requestedProductPrice = toFiniteNumber(req.body?.product_price, NaN);
  const productPrice = Number.isFinite(requestedProductPrice) && requestedProductPrice > 0 ? requestedProductPrice : null;
  const cardMessage = cleanNullableText(req.body?.card_message);
  const deliveryDate = cleanNullableText(req.body?.delivery_date);
  const authorizeNetToken = cleanNullableText(req.body?.authorizenet_token);

  if (!Number.isFinite(targetSinglesId) || targetSinglesId < 1) {
    logSendFlower(traceId, 'placeOrder:bad-target', { targetSinglesId });
    return res.status(400).json({ error: 'target_singles_id is required' });
  }
  if (targetSinglesId === senderSinglesId) {
    logSendFlower(traceId, 'placeOrder:self-target');
    return res.status(400).json({ error: 'Cannot send flower to yourself' });
  }
  if (!productId) {
    logSendFlower(traceId, 'placeOrder:missing-product');
    return res.status(400).json({ error: 'product_id is required' });
  }

  const florisConfig = getFlorisOneConfig();
  if (!florisConfig.apiKey || !florisConfig.password) {
    logSendFlower(traceId, 'placeOrder:missing-floris-credentials');
    return res.status(500).json({ error: 'FlorisOne credentials are not configured' });
  }

  const client = await pool.connect();
  try {
    const { sender, recipient } = await getSinglesAddressPair(client, senderSinglesId, targetSinglesId);
    if (!sender) return res.status(404).json({ error: 'Sender profile not found' });
    if (!recipient) return res.status(404).json({ error: 'Recipient profile not found' });
    enforceRecipientPrefixRule(sender, recipient);

    const sendFromAddress = resolveSendFromAddress(sender, req.body);
    const sendToAddress = toFlorisOneAddressPayload(recipient);
    logSendFlower(traceId, 'placeOrder:addresses', {
      sendFrom: summarizeAddressForLogs(sendFromAddress),
      sendTo: summarizeAddressForLogs(sendToAddress)
    });
    validateAddressComplete('Send from', sendFromAddress);
    validateAddressComplete('Send to', sendToAddress);

    const recipientCountryCode = toCountryCode(sendToAddress.country);
    const fallbackState = toSafeStateCode(process.env.FLORISTONE_DEFAULT_STATE || 'CA');
    const totalParams = {
      product: productId,
      'products[0][code]': productId,
      'products[0][qty]': '1',
      zip: sendToAddress.zip,
      zipcode: sendToAddress.zip,
      country: recipientCountryCode,
      recipient_zipcode: sendToAddress.zip,
      'recipient zipcode': sendToAddress.zip,
      'recipient[zipcode]': sendToAddress.zip,
      'recipient[zip]': sendToAddress.zip,
      'recipient[country]': recipientCountryCode,
      'recipient[state]': fallbackState,
      'products[0][recipient][zipcode]': sendToAddress.zip,
      'products[0][recipient][zip]': sendToAddress.zip
    };
    if (productPrice != null) {
      const productPriceText = toMoneyAmount(productPrice);
      totalParams.price = productPriceText;
      totalParams['products[0][price]'] = productPriceText;
    }
    if (deliveryDate) totalParams.deliverydate = deliveryDate;
    logSendFlower(traceId, 'placeOrder:total-request', {
      totalPath: florisConfig.totalPath,
      totalParams
    });

    let floristTotalResponse = null;
    let amountPaid = null;
    try {
      floristTotalResponse = await callFlorisOne(florisConfig, florisConfig.totalPath, totalParams);
      logSendFlower(traceId, 'placeOrder:total-response', floristTotalResponse);
      if (isMissingProductsTotalError(floristTotalResponse)) {
        const fallbackProductPrice = productPrice != null ? toMoneyAmount(productPrice) : null;
        const fallbackTotalPayload = {
          product: productId,
          zip: sendToAddress.zip,
          zipcode: sendToAddress.zip,
          country: recipientCountryCode,
          recipient_zipcode: sendToAddress.zip,
          recipient: {
            zipcode: sendToAddress.zip,
            zip: sendToAddress.zip,
            country: recipientCountryCode,
            state: fallbackState
          },
          products: [
            {
              code: productId,
              qty: '1',
              recipient: {
                zipcode: sendToAddress.zip,
                zip: sendToAddress.zip,
                country: recipientCountryCode,
                state: fallbackState
              },
              ...(fallbackProductPrice ? { price: fallbackProductPrice } : {})
            }
          ]
        };
        if (fallbackProductPrice) fallbackTotalPayload.price = fallbackProductPrice;
        if (deliveryDate) fallbackTotalPayload.deliverydate = deliveryDate;
        logSendFlower(traceId, 'placeOrder:total-fallback-request', fallbackTotalPayload);
        floristTotalResponse = await callFlorisOne(florisConfig, florisConfig.totalPath, null, {
          method: 'POST',
          jsonBody: fallbackTotalPayload
        });
        logSendFlower(traceId, 'placeOrder:total-fallback-response', floristTotalResponse);
      }
      amountPaid = extractAmountFromFlorisTotal(floristTotalResponse);
      logSendFlower(traceId, 'placeOrder:amount-after-total', {
        amountPaid,
        issues: extractFlorisValidationErrors(floristTotalResponse)
      });
      if (!Number.isFinite(Number(amountPaid)) || Number(amountPaid) <= 0) {
        const issues = extractFlorisValidationErrors(floristTotalResponse);
        const requiresPrice = issues.some((issue) => /product\s+price\s+is\s+required/i.test(String(issue)));
        if (requiresPrice && productPrice != null) {
          amountPaid = productPrice;
          logSendFlower(traceId, 'placeOrder:amount-fallback-from-client-price', {
            productPrice: toMoneyAmount(productPrice)
          });
        }
      }
    } catch (err) {
      logSendFlower(traceId, 'placeOrder:total-failed', {
        message: err?.message || String(err),
        statusCode: err?.statusCode || null,
        responseBody: err?.responseBody || null
      });
    }

    let floristOrderResponse = null;
    let floristOrderId = null;
    let status = 'pending_payment';
    if (authorizeNetToken) {
      const orderTotalValue = Number.isFinite(Number(amountPaid)) ? Number(amountPaid) : null;
      if (!Number.isFinite(orderTotalValue) || orderTotalValue <= 0) {
        const florisIssues = extractFlorisValidationErrors(floristTotalResponse);
        const details = florisIssues.length ? ` (${florisIssues.join('; ')})` : '';
        logSendFlower(traceId, 'placeOrder:abort-no-total', { orderTotalValue, florisIssues });
        return res.status(400).json({ error: `Unable to compute order total for selected product/delivery location${details}` });
      }
      const countryCode = recipientCountryCode;
      const senderCountryCode = toCountryCode(sendFromAddress.country);
      const placeOrderBody = {
        customer: {
          name: sendFromAddress.full_name,
          email: sendFromAddress.email,
          address1: sendFromAddress.street,
          address2: '',
          city: sendFromAddress.city,
          state: fallbackState,
          country: senderCountryCode,
          phone: String(sendFromAddress.phone || '').replace(/\D/g, '').slice(-10),
          zipcode: sendFromAddress.zip,
          ip: firstForwardedIp(req.headers['x-forwarded-for']) || cleanNullableText(req.ip) || '127.0.0.1'
        },
        products: [
          {
            code: productId,
            price: toMoneyAmount(orderTotalValue),
            deliverydate: deliveryDate,
            cardmessage: cardMessage || 'A sweet flower gift for you',
            recipient: {
              name: sendToAddress.full_name,
              institution: '',
              address1: sendToAddress.street,
              address2: '',
              city: sendToAddress.city,
              state: fallbackState,
              country: countryCode,
              phone: String(sendToAddress.phone || '').replace(/\D/g, '').slice(-10),
              zipcode: sendToAddress.zip
            }
          }
        ],
        ccinfo: { authorizenet_token: authorizeNetToken },
        ordertotal: toMoneyAmount(orderTotalValue)
      };

      try {
        logSendFlower(traceId, 'placeOrder:submit-primary', {
          placeOrderPath: florisConfig.placeOrderPath,
          ordertotal: placeOrderBody?.ordertotal,
          productCode: productId
        });
        floristOrderResponse = await callFlorisOne(florisConfig, florisConfig.placeOrderPath, null, {
          method: 'POST',
          jsonBody: placeOrderBody
        });
        floristOrderId =
          cleanNullableText(floristOrderResponse?.ORDERNO) || cleanNullableText(floristOrderResponse?.orderno) || extractFlorisOrderId(floristOrderResponse);
        status = floristOrderId ? 'ordered' : 'submitted';
        logSendFlower(traceId, 'placeOrder:submit-primary-success', { status, floristOrderId });
      } catch (err) {
        const errMessage = err?.message || 'FlorisOne order error';
        logSendFlower(traceId, 'placeOrder:submit-primary-failed', {
          message: errMessage,
          statusCode: err?.statusCode || null,
          responseBody: err?.responseBody || null
        });
        if (isMissingPlaceOrderFieldError(errMessage)) {
          const fallbackParams = {
            'customer[name]': sendFromAddress.full_name,
            'customer[email]': sendFromAddress.email,
            'customer[address1]': sendFromAddress.street,
            'customer[address2]': '',
            'customer[city]': sendFromAddress.city,
            'customer[state]': fallbackState,
            'customer[country]': senderCountryCode,
            'customer[phone]': String(sendFromAddress.phone || '').replace(/\D/g, '').slice(-10),
            'customer[zipcode]': sendFromAddress.zip,
            'customer[ip]': firstForwardedIp(req.headers['x-forwarded-for']) || cleanNullableText(req.ip) || '127.0.0.1',
            'products[0][code]': productId,
            'products[0][price]': toMoneyAmount(orderTotalValue),
            'products[0][deliverydate]': deliveryDate,
            'products[0][cardmessage]': cardMessage || 'A sweet flower gift for you',
            'products[0][recipient][name]': sendToAddress.full_name,
            'products[0][recipient][institution]': '',
            'products[0][recipient][address1]': sendToAddress.street,
            'products[0][recipient][address2]': '',
            'products[0][recipient][city]': sendToAddress.city,
            'products[0][recipient][state]': fallbackState,
            'products[0][recipient][country]': countryCode,
            'products[0][recipient][phone]': String(sendToAddress.phone || '').replace(/\D/g, '').slice(-10),
            'products[0][recipient][zipcode]': sendToAddress.zip,
            'ccinfo[authorizenet_token]': authorizeNetToken,
            ordertotal: toMoneyAmount(orderTotalValue)
          };
          try {
            logSendFlower(traceId, 'placeOrder:submit-fallback', {
              placeOrderPath: florisConfig.placeOrderPath,
              ordertotal: fallbackParams?.ordertotal,
              productCode: productId
            });
            floristOrderResponse = await callFlorisOne(florisConfig, florisConfig.placeOrderPath, fallbackParams);
            floristOrderId =
              cleanNullableText(floristOrderResponse?.ORDERNO) || cleanNullableText(floristOrderResponse?.orderno) || extractFlorisOrderId(floristOrderResponse);
            status = floristOrderId ? 'ordered' : 'submitted';
            logSendFlower(traceId, 'placeOrder:submit-fallback-success', { status, floristOrderId });
          } catch (fallbackErr) {
            status = 'api_error';
            floristOrderResponse = { error: fallbackErr?.message || errMessage, statusCode: fallbackErr?.statusCode || err?.statusCode || null };
            logSendFlower(traceId, 'placeOrder:submit-fallback-failed', {
              message: fallbackErr?.message || errMessage,
              statusCode: fallbackErr?.statusCode || err?.statusCode || null,
              responseBody: fallbackErr?.responseBody || null
            });
          }
        } else {
          status = 'api_error';
          floristOrderResponse = { error: errMessage, statusCode: err?.statusCode || null };
        }
      }
    } else {
      floristOrderResponse = {
        info: 'Order saved in pending_payment state; authorizenet_token is required to submit Place Order to FloristOne.'
      };
      logSendFlower(traceId, 'placeOrder:pending-payment-without-token');
    }

    logSendFlower(traceId, 'placeOrder:db-begin');
    await client.query('BEGIN');
    const dbRow = await insertGiftTransaction(client, {
      singles_id: senderSinglesId,
      recipient_id: targetSinglesId,
      product_id: productId,
      amount_paid: amountPaid,
      status,
      delivery_date: deliveryDate,
      card_message: cardMessage,
      send_to_address: composeAddressLabel(sendToAddress),
      send_from_address: composeAddressLabel(sendFromAddress),
      florist_order_id: floristOrderId,
      trace_id: traceId,
      florist_response_json: {
        total: floristTotalResponse,
        place_order: floristOrderResponse
      }
    });
    const paymentRow =
      status === 'api_error'
        ? { paymentId: null, transactionId: null }
        : await createGiftPaymentHistoryRow(client, {
            singlesId: senderSinglesId,
            recipient,
            productId,
            amountPaid,
            floristOrderId,
            deliveryDate,
            traceId
          });
    await client.query('COMMIT');
    logSendFlower(traceId, 'placeOrder:db-commit', {
      transactionId: dbRow?.id ?? null,
      paymentId: paymentRow?.paymentId ?? null,
      generatedTransactionId: paymentRow?.transactionId ?? null,
      status
    });

    if (status !== 'api_error') {
      sendGiftNotificationEmailsFireAndForget({
        sender,
        recipient,
        amountPaid,
        productId,
        orderDate: dbRow?.created_at || new Date(),
        expectedDeliveryDate: deliveryDate
      });
    }

    if (status === 'api_error') {
      logSendFlower(traceId, 'placeOrder:return-api-error', {
        message: cleanNullableText(floristOrderResponse?.error) || 'FlorisOne order submission failed'
      });
      return res.status(502).json({
        error: cleanNullableText(floristOrderResponse?.error) || 'FlorisOne order submission failed',
        transaction: dbRow
      });
    }

    logSendFlower(traceId, 'placeOrder:success', {
      florist_order_id: floristOrderId,
      amount_paid: amountPaid,
      payment_id: paymentRow?.paymentId ?? null,
      transaction_id: paymentRow?.transactionId ?? null
    });
    return res.json({
      ok: true,
      transaction: dbRow,
      florist_order_id: floristOrderId,
      amount_paid: amountPaid,
      payment_id: paymentRow?.paymentId ?? null,
      transaction_id: paymentRow?.transactionId ?? null
    });
  } catch (error) {
    try {
      await client.query('ROLLBACK');
      logSendFlower(traceId, 'placeOrder:db-rollback');
    } catch {
      // ignore rollback error
    }
    logSendFlower(traceId, 'placeOrder:error', {
      message: error?.message || String(error),
      statusCode: Number(error?.statusCode) || null,
      stack: error?.stack || null
    });
    const statusCode = Number(error?.statusCode) || 500;
    return res.status(statusCode).json({ error: error?.message || 'Failed to place flower order' });
  } finally {
    client.release();
  }
}

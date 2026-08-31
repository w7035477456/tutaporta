#!/usr/bin/env node
/**
 * Build helloworldjunktest.us_population_by_city from Census Vintage 2025
 * incorporated places (SUMLEV 162) + a representative ZIP.
 *
 * percentage_of_total = city population / total US population * 100.
 *
 * Usage (Mac, from repo root):
 *   node be/scripts/loadUsPopulationByCity.js
 */
import '../loadEnv.js';
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import pg from 'pg';
import { getDBConfig, getDBSchema } from '../config/envConfig.js';
import {
  CACHE_DIR,
  CENSUS_SUBEST_URL,
  CENSUS_ZCTA_PLACE_URL,
  GEONAMES_US_ZIP_URL,
  displayCityName,
  downloadToFile,
  padZip,
  parseCsvLine
} from './usCityPopulationShared.js';

const { Client } = pg;

function schemaIdent() {
  return String(getDBSchema() || 'helloworldjunktest').replace(/"/g, '""');
}

function unzipGeonames(zipPath) {
  const destTxt = path.join(CACHE_DIR, 'US.txt');
  if (fs.existsSync(destTxt) && fs.statSync(destTxt).size > 1000) return destTxt;
  execFileSync('unzip', ['-o', zipPath, 'US.txt', '-d', CACHE_DIR], { stdio: 'pipe' });
  return destTxt;
}

function loadZctaBestZip(filePath) {
  const best = new Map();
  const raw = fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '');
  const lines = raw.split(/\r?\n/);
  const header = lines[0]?.split('|') || [];
  const iZip = header.indexOf('GEOID_ZCTA5_20');
  const iPlace = header.indexOf('GEOID_PLACE_20');
  const iLand = header.indexOf('AREALAND_PART');
  if (iZip < 0 || iPlace < 0 || iLand < 0) {
    throw new Error('Unexpected ZCTA-place header');
  }
  for (let i = 1; i < lines.length; i += 1) {
    if (!lines[i]) continue;
    const cols = lines[i].split('|');
    const zip = padZip(cols[iZip]);
    const place = String(cols[iPlace] || '').trim();
    const land = Number(cols[iLand] || 0);
    if (!zip || !place) continue;
    const prev = best.get(place);
    if (!prev || land > prev.land) best.set(place, { zip, land });
  }
  const out = new Map();
  for (const [place, rec] of best) out.set(place, rec.zip);
  return out;
}

function loadGeonamesZips(filePath) {
  const byCityState = new Map();
  const firstZipByState = new Map();
  const raw = fs.readFileSync(filePath, 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    if (!line) continue;
    const parts = line.split('\t');
    const zip = padZip(parts[1]);
    const city = String(parts[2] || '').trim().toLowerCase();
    const stateName = String(parts[3] || '').trim().toLowerCase();
    const stateAbbr = String(parts[4] || '').trim().toLowerCase();
    if (!zip || !city) continue;
    const keys = [`${city}|${stateName}`, `${city}|${stateAbbr}`];
    for (const key of keys) {
      if (!byCityState.has(key)) byCityState.set(key, zip);
    }
    if (stateName && !firstZipByState.has(stateName)) firstZipByState.set(stateName, zip);
    if (stateAbbr && !firstZipByState.has(stateAbbr)) firstZipByState.set(stateAbbr, zip);
  }
  return { byCityState, firstZipByState };
}

function parseCensusPlaces(filePath) {
  const raw = fs.readFileSync(filePath, 'latin1');
  const lines = raw.split(/\r?\n/).filter(Boolean);
  const header = parseCsvLine(lines[0]);
  const idx = Object.fromEntries(header.map((name, i) => [name, i]));
  const need = ['SUMLEV', 'STATE', 'PLACE', 'NAME', 'STNAME', 'POPESTIMATE2025'];
  for (const col of need) {
    if (idx[col] == null) throw new Error(`Census CSV missing column ${col}`);
  }

  let usTotal = 0;
  const places = [];
  for (let i = 1; i < lines.length; i += 1) {
    const cols = parseCsvLine(lines[i]);
    const sumlev = cols[idx.SUMLEV];
    const pop = Number(cols[idx.POPESTIMATE2025] || 0);
    if (sumlev === '040' && pop > 0) usTotal += pop;
    if (sumlev !== '162' || !(pop > 0)) continue;
    const geoid = String(cols[idx.STATE] || '').padStart(2, '0') + String(cols[idx.PLACE] || '').padStart(5, '0');
    places.push({
      geoid,
      rawName: cols[idx.NAME],
      stateName: cols[idx.STNAME],
      population: pop
    });
  }
  if (!(usTotal > 0)) throw new Error('Could not compute US total population from SUMLEV 040');
  return { usTotal, places };
}

function resolveZip(place, zctaByGeoid, geo) {
  const fromZcta = zctaByGeoid.get(place.geoid);
  if (fromZcta) return fromZcta;
  const display = displayCityName(place.rawName).toLowerCase();
  const state = place.stateName.toLowerCase();
  const fromGeo =
    geo.byCityState.get(`${display}|${state}`) ||
    geo.byCityState.get(`${String(place.rawName).trim().toLowerCase()}|${state}`);
  if (fromGeo) return fromGeo;
  const firstWord = display.split(/[\s-/]/)[0];
  const fromWord = geo.byCityState.get(`${firstWord}|${state}`);
  if (fromWord) return fromWord;
  return geo.firstZipByState.get(state) || '00000';
}

function buildRows(places, usTotal, zctaByGeoid, geo) {
  const used = new Map();
  const rows = [];
  const sorted = [...places].sort((a, b) => b.population - a.population);
  for (const place of sorted) {
    let cityName = displayCityName(place.rawName);
    if (!cityName) cityName = String(place.rawName).trim();
    const collisionKey = `${cityName.toLowerCase()}|${place.stateName.toLowerCase()}`;
    if (used.has(collisionKey)) {
      const existing = used.get(collisionKey);
      if (place.population <= existing.population) continue;
      existing.population = place.population;
      existing.zipcode = resolveZip(place, zctaByGeoid, geo);
      existing.percentage_of_total = (place.population / usTotal) * 100;
      continue;
    }
    const row = {
      city_name: cityName,
      population: place.population,
      state_name: place.stateName,
      zipcode: resolveZip(place, zctaByGeoid, geo),
      percentage_of_total: (place.population / usTotal) * 100
    };
    used.set(collisionKey, row);
    rows.push(row);
  }
  return rows;
}

async function insertRows(client, schema, rows) {
  await client.query(`TRUNCATE TABLE "${schema}".us_population_by_city RESTART IDENTITY`);
  const batchSize = 300;
  for (let i = 0; i < rows.length; i += batchSize) {
    const chunk = rows.slice(i, i + batchSize);
    const params = [];
    const values = chunk.map((row, idx) => {
      const base = idx * 5;
      params.push(
        row.city_name,
        row.population,
        row.state_name,
        row.zipcode,
        row.percentage_of_total
      );
      return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5})`;
    });
    await client.query(
      `INSERT INTO "${schema}".us_population_by_city
         (city_name, population, state_name, zipcode, percentage_of_total)
       VALUES ${values.join(', ')}`,
      params
    );
  }
}

async function main() {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  const subestPath = path.join(CACHE_DIR, 'sub-est2025.csv');
  const zctaPath = path.join(CACHE_DIR, 'tab20_zcta520_place20_natl.txt');
  const geoZipPath = path.join(CACHE_DIR, 'US.zip');

  console.log('Downloading Census / GeoNames files (cached in', CACHE_DIR, ')...');
  await downloadToFile(CENSUS_SUBEST_URL, subestPath);
  await downloadToFile(CENSUS_ZCTA_PLACE_URL, zctaPath);
  await downloadToFile(GEONAMES_US_ZIP_URL, geoZipPath);
  const geoTxtPath = unzipGeonames(geoZipPath);

  const { usTotal, places } = parseCensusPlaces(subestPath);
  const zctaByGeoid = loadZctaBestZip(zctaPath);
  const geo = loadGeonamesZips(geoTxtPath);
  const rows = buildRows(places, usTotal, zctaByGeoid, geo);

  const sqlPath = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../db/createUsPopulationByCity.sql');
  const schema = schemaIdent();
  const cfg = getDBConfig();
  const client = new Client({
    host: cfg.host,
    port: cfg.port,
    database: cfg.database,
    user: cfg.user,
    password: cfg.password
  });
  await client.connect();
  try {
    await client.query(fs.readFileSync(sqlPath, 'utf8'));
    await insertRows(client, schema, rows);
    const { rows: stats } = await client.query(
      `SELECT count(*)::int AS n,
              sum(population)::bigint AS city_pop_sum,
              max(percentage_of_total) AS max_pct,
              (SELECT city_name FROM "${schema}".us_population_by_city ORDER BY population DESC LIMIT 1) AS top_city
       FROM "${schema}".us_population_by_city`
    );
    const top = stats[0];
    console.log(
      `Loaded ${top.n} cities. US total=${usTotal}. Largest=${top.top_city} (${Number(top.max_pct).toFixed(4)}%).`
    );
    console.log(`Sum of city populations=${top.city_pop_sum} (less than US total: rural / non-place residents).`);
  } finally {
    await client.end();
  }
  process.exit(0);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});

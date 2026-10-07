/**
 * Desktop / Mobile + browser + OS from the request User-Agent (login_log, hard-copy logs, Admin Tools).
 * iPadOS Safari reports itself as "Macintosh", so those iPads show as Desktop · Safari · Mac.
 * Chrome on Ubuntu sends plain "X11; Linux" — only Firefox (and some distro builds) say "Ubuntu".
 */
import {
  LOGIN_SESSION_DEVICE_MOBILE,
  inferLoginSessionDeviceClassFromUserAgent
} from './loginSessionDeviceClass.js';

export const CLIENT_DEVICE_DESKTOP = 'Desktop';
export const CLIENT_DEVICE_MOBILE = 'Mobile';

const BROWSER_RULES = [
  [/Edg(e|A|iOS)?\//, 'Edge'],
  [/OPR\/|OPiOS\/|Opera/, 'Opera'],
  [/SamsungBrowser\//, 'Samsung'],
  [/Firefox\/|FxiOS\//, 'Firefox'],
  [/Chrome\/|CriOS\/|Chromium\//, 'Chrome'],
  [/Safari\//, 'Safari']
];

const OS_RULES = [
  [/iPhone|iPad|iPod/, 'iOS'],
  [/Android/, 'Android'],
  [/Windows/, 'Windows'],
  [/CrOS/, 'ChromeOS'],
  [/Macintosh|Mac OS X/, 'Mac'],
  [/Ubuntu/, 'Ubuntu'],
  [/Linux|X11/, 'Linux']
];

function firstMatch(rules, ua) {
  for (const [re, label] of rules) {
    if (re.test(ua)) return label;
  }
  return 'Other';
}

/**
 * @param {string | null | undefined} userAgent
 * @returns {{ deviceType: string, browser: string, os: string } | null} null when no User-Agent
 */
export function parseClientDevice(userAgent) {
  const ua = String(userAgent ?? '').trim();
  if (!ua) return null;
  const deviceType =
    inferLoginSessionDeviceClassFromUserAgent(ua) === LOGIN_SESSION_DEVICE_MOBILE
      ? CLIENT_DEVICE_MOBILE
      : CLIENT_DEVICE_DESKTOP;
  return { deviceType, browser: firstMatch(BROWSER_RULES, ua), os: firstMatch(OS_RULES, ua) };
}

/** @param {import('express').Request | null | undefined} req */
export function clientDeviceFromReq(req) {
  return parseClientDevice(req?.headers?.['user-agent']);
}

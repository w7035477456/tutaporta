/**
 * Shared helpers for Census city-population load + RegularMember address scatter.
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import { pipeline } from 'stream/promises';
import { createWriteStream } from 'fs';
import { Readable } from 'stream';

export const CENSUS_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

export const CENSUS_SUBEST_URL =
  'https://www2.census.gov/programs-surveys/popest/datasets/2020-2025/cities/totals/sub-est2025.csv';

export const CENSUS_ZCTA_PLACE_URL =
  'https://www2.census.gov/geo/docs/maps-data/data/rel2020/zcta520/tab20_zcta520_place20_natl.txt';

export const GEONAMES_US_ZIP_URL = 'https://download.geonames.org/export/zip/US.zip';

export const CACHE_DIR = path.join(os.tmpdir(), 'us_pop_cities');

export const STATE_ABBR = {
  Alabama: 'AL',
  Alaska: 'AK',
  Arizona: 'AZ',
  Arkansas: 'AR',
  California: 'CA',
  Colorado: 'CO',
  Connecticut: 'CT',
  Delaware: 'DE',
  'District of Columbia': 'DC',
  Florida: 'FL',
  Georgia: 'GA',
  Hawaii: 'HI',
  Idaho: 'ID',
  Illinois: 'IL',
  Indiana: 'IN',
  Iowa: 'IA',
  Kansas: 'KS',
  Kentucky: 'KY',
  Louisiana: 'LA',
  Maine: 'ME',
  Maryland: 'MD',
  Massachusetts: 'MA',
  Michigan: 'MI',
  Minnesota: 'MN',
  Mississippi: 'MS',
  Missouri: 'MO',
  Montana: 'MT',
  Nebraska: 'NE',
  Nevada: 'NV',
  'New Hampshire': 'NH',
  'New Jersey': 'NJ',
  'New Mexico': 'NM',
  'New York': 'NY',
  'North Carolina': 'NC',
  'North Dakota': 'ND',
  Ohio: 'OH',
  Oklahoma: 'OK',
  Oregon: 'OR',
  Pennsylvania: 'PA',
  'Rhode Island': 'RI',
  'South Carolina': 'SC',
  'South Dakota': 'SD',
  Tennessee: 'TN',
  Texas: 'TX',
  Utah: 'UT',
  Vermont: 'VT',
  Virginia: 'VA',
  Washington: 'WA',
  'West Virginia': 'WV',
  Wisconsin: 'WI',
  Wyoming: 'WY'
};

export const STREET_STEMS = [
  'Main St',
  'Oak Ave',
  'Pine Rd',
  'Maple Blvd',
  'Cedar Ln',
  'Elm St',
  'River Rd',
  'Sunset Dr',
  'Lake View Dr',
  'Highland Ave',
  'Washington St',
  'Park Ave',
  'Church St',
  'Market St',
  '2nd Ave',
  '3rd St',
  'Birch Ct',
  'Willow Way',
  'Valley Rd',
  'Hillcrest Dr'
];

export function parseCsvLine(line) {
  const out = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (inQ) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i += 1;
        } else {
          inQ = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQ = true;
    } else if (ch === ',') {
      out.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

export function displayCityName(rawName) {
  const raw = String(rawName ?? '').trim();
  let n = raw.replace(/\s*\(balance\)\s*$/i, '').trim();
  if (/^Urban Honolulu\b/i.test(n)) n = 'Honolulu';
  n = n.replace(/\s+(unified|consolidated|metro|metropolitan)\s+government.*$/i, '').trim();
  if (/[-/]/.test(n) && (/county/i.test(n) || /\(balance\)|government/i.test(raw))) {
    n = n.split(/[-/]/)[0].trim();
  }
  n = n.replace(/\s+(city|town|village|borough|municipality|CDP)$/i, '').trim();
  return n.replace(/\s+/g, ' ');
}

export function padZip(zip) {
  const digits = String(zip ?? '').replace(/\D/g, '');
  if (!digits) return '';
  return digits.slice(0, 5).padStart(5, '0');
}

export async function downloadToFile(url, destPath) {
  if (fs.existsSync(destPath) && fs.statSync(destPath).size > 1000) {
    return destPath;
  }
  fs.mkdirSync(path.dirname(destPath), { recursive: true });
  const res = await fetch(url, { headers: { 'User-Agent': CENSUS_UA } });
  if (!res.ok) {
    throw new Error(`Download failed ${res.status} ${res.statusText}: ${url}`);
  }
  const tmp = `${destPath}.part`;
  await pipeline(Readable.fromWeb(res.body), createWriteStream(tmp));
  fs.renameSync(tmp, destPath);
  return destPath;
}

export function pickWeightedByPercentage(rows, rng = Math.random) {
  let total = 0;
  for (const row of rows) {
    const w = Number(row.percentage_of_total);
    if (Number.isFinite(w) && w > 0) total += w;
  }
  if (!(total > 0)) {
    throw new Error('No positive PercentageOfTotal weights');
  }
  let x = rng() * total;
  for (const row of rows) {
    const w = Number(row.percentage_of_total);
    if (!(Number.isFinite(w) && w > 0)) continue;
    x -= w;
    if (x <= 0) return row;
  }
  return rows[rows.length - 1];
}

export function buildStreetAddress(cityName, stateName, zipcode, rng = Math.random) {
  const n = 100 + Math.floor(rng() * 9900);
  const stem = STREET_STEMS[Math.floor(rng() * STREET_STEMS.length)];
  const abbr = STATE_ABBR[stateName] || '';
  const zip = padZip(zipcode);
  return {
    mailing_street: `${n} ${stem}`,
    mailing_city: cityName,
    mailing_zip: zip,
    mailing_country: 'USA',
    dl_city: cityName,
    current_city: abbr ? `${cityName}, ${abbr}` : cityName,
    homecity: abbr ? `${cityName}, ${abbr}` : cityName
  };
}

#!/usr/bin/env node
/**
 * Reassign RegularMember mailing / DL / vet_bio addresses using
 * us_population_by_city.percentage_of_total as the pick weight.
 *
 * Example: if New York City is 2.51% of the US, it is chosen ~2.51% of the time.
 *
 * Usage (Mac, from repo root):
 *   node be/scripts/scatterRegularMemberAddresses.js
 *   node be/scripts/scatterRegularMemberAddresses.js --dry-run
 */
import '../loadEnv.js';
import pg from 'pg';
import { getDBConfig, getDBSchema } from '../config/envConfig.js';
import { buildStreetAddress, pickWeightedByPercentage } from './usCityPopulationShared.js';

const { Client } = pg;

function schemaIdent() {
  return String(getDBSchema() || 'helloworldjunktest').replace(/"/g, '""');
}

function parseArgs(argv) {
  return { dryRun: argv.includes('--dry-run') };
}

async function main() {
  const { dryRun } = parseArgs(process.argv.slice(2));
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
    const { rows: cities } = await client.query(
      `SELECT city_name, population, state_name, zipcode, percentage_of_total
       FROM "${schema}".us_population_by_city
       WHERE percentage_of_total > 0
       ORDER BY percentage_of_total DESC`
    );
    if (cities.length < 1) {
      throw new Error('us_population_by_city is empty. Run: node be/scripts/loadUsPopulationByCity.js');
    }

    const { rows: members } = await client.query(
      `SELECT s.singles_id, s.email, s.alias
       FROM "${schema}".singles s
       WHERE TRIM(s.member_category::text) = 'REGULARMEMBER'
       ORDER BY s.singles_id`
    );
    if (members.length < 1) {
      console.log('No REGULARMEMBER rows to update.');
      process.exit(0);
    }

    const assignments = members.map((member) => {
      const city = pickWeightedByPercentage(cities);
      const addr = buildStreetAddress(city.city_name, city.state_name, city.zipcode);
      return { member, city, addr };
    });

    if (dryRun) {
      console.log(`Dry run — ${assignments.length} RegularMembers, ${cities.length} cities:`);
      for (const row of assignments) {
        console.log(
          `  ${row.member.email} → ${row.addr.mailing_street}, ${row.addr.current_city} ${row.addr.mailing_zip} (${Number(row.city.percentage_of_total).toFixed(4)}%)`
        );
      }
      process.exit(0);
    }

    await client.query('BEGIN');
    for (const row of assignments) {
      await client.query(
        `UPDATE "${schema}".singles
         SET mailing_street = $1,
             mailing_city = $2,
             mailing_zip = $3,
             mailing_country = $4,
             dl_city = $5,
             updated_at = CURRENT_TIMESTAMP
         WHERE singles_id = $6`,
        [
          row.addr.mailing_street,
          row.addr.mailing_city,
          row.addr.mailing_zip,
          row.addr.mailing_country,
          row.addr.dl_city,
          row.member.singles_id
        ]
      );
      await client.query(
        `UPDATE "${schema}".vet_bio
         SET current_city = $1,
             homecity = $2
         WHERE singles_id = $3`,
        [row.addr.current_city, row.addr.homecity, row.member.singles_id]
      );
    }
    await client.query('COMMIT');

    console.log(`Updated ${assignments.length} RegularMember addresses:`);
    for (const row of assignments) {
      console.log(
        `  ${row.member.email} (${row.member.alias}) → ${row.addr.mailing_street}, ${row.addr.current_city} ${row.addr.mailing_zip}`
      );
    }
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch {
      /* ignore */
    }
    throw err;
  } finally {
    await client.end();
  }
  process.exit(0);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});

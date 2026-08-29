import '../loadEnv.js';
import pool from '../db/connection.js';
import { addAltEmailCopies } from '../lib/outboundMail.js';

const MAIN = 'dm2@gmail.com';
const ALT = 'alt-copy-test@example.com';
const OTHER = 'stranger@example.com';

const results = [];
function check(name, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  results.push({ name, ok, actual, expected });
}

await pool.query('UPDATE helloworldjunktest.singles SET alt_email = $1 WHERE email = $2', [ALT, MAIN]);

check('plain member recipient', (await addAltEmailCopies({ to: MAIN })).cc, [ALT]);
check('display-name form', (await addAltEmailCopies({ to: `"Sam" <${MAIN}>` })).cc, [ALT]);
check('uppercase recipient', (await addAltEmailCopies({ to: MAIN.toUpperCase() })).cc, [ALT]);
check('array recipients', (await addAltEmailCopies({ to: [OTHER, MAIN] })).cc, [ALT]);
check('existing cc preserved', (await addAltEmailCopies({ to: MAIN, cc: OTHER })).cc, [OTHER, ALT]);
check('no duplicate when already cc', (await addAltEmailCopies({ to: MAIN, cc: ALT })).cc, ALT);
check('no duplicate when already bcc', (await addAltEmailCopies({ to: MAIN, bcc: ALT })).cc, undefined);
check('non-member untouched', (await addAltEmailCopies({ to: OTHER })).cc, undefined);
check('subject/html untouched', (await addAltEmailCopies({ to: MAIN, subject: 'x' })).subject, 'x');

await pool.query('UPDATE helloworldjunktest.singles SET alt_email = NULL WHERE email = $1', [MAIN]);
check('cleared alt adds nothing', (await addAltEmailCopies({ to: MAIN })).cc, undefined);

for (const r of results) {
  console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}`);
  if (!r.ok) console.log(`      expected ${JSON.stringify(r.expected)} got ${JSON.stringify(r.actual)}`);
}
console.log(results.every((r) => r.ok) ? 'ALL PASS' : 'SOME FAILED');
await pool.end();

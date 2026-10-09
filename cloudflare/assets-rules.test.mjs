// node cloudflare/assets-rules.test.mjs
// The Cloudflare _headers / _redirects are generated from vercel.json; this fails if a rule is dropped or mistranslated on the way.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { rulesFromVercel } from './assets-rules.mjs';

const vercel = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));
const { headersFile, redirectsFile } = rulesFromVercel(vercel);

// every legacy redirect, in order, as "source destination status"
const redirects = redirectsFile.split('\n').filter((l) => l && !l.startsWith('#'));
assert.equal(redirects.length, vercel.redirects.length);
assert.equal(redirects.length, 31);
vercel.redirects.forEach((r, i) => assert.equal(redirects[i], `${r.source} ${r.destination} ${r.statusCode}`));

// every vercel.json header (except the *.vercel.app noindex) is present under its translated path
for (const h of vercel.headers.filter((h) => !h.has)) {
  const pattern = h.source.replace('(.*)', '*');
  const block = headersFile.split('\n').slice(headersFile.split('\n').indexOf(pattern) + 1).join('\n');
  assert.ok(headersFile.split('\n').includes(pattern), `missing header rule for ${pattern}`);
  for (const { key, value } of h.headers) assert.ok(block.includes(`  ${key}: ${value}`), `${pattern}: missing ${key}`);
}
assert.ok(!headersFile.includes('vercel.app'));
assert.match(headersFile, /^\/_astro\/\*\n {2}Cache-Control: public, max-age=31536000, immutable$/m);
assert.match(headersFile, /^https:\/\/:worker\.:subdomain\.workers\.dev\/\*\n {2}X-Robots-Tag: noindex, nofollow$/m);
assert.throws(() => rulesFromVercel({ headers: [{ source: '/a/(b|c)/(.*)', headers: [] }] }), /cannot translate/);
console.log('cloudflare assets-rules: ok');

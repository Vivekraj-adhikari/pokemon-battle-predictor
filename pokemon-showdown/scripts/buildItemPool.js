'use strict';
/**
 * One-time ETL: build data/common-items.json, a { [speciesId]: itemId[] }
 * lookup of "commonly used competitive items" per species, from Smogon's
 * public monthly usage-stats snapshots.
 *
 * NOTE: this script needs real internet access to www.smogon.com. It will
 * NOT run inside a sandboxed/offline environment -- run it on your own
 * machine. (Verified the URL scheme against the live site while designing
 * this: https://www.smogon.com/stats/<YYYY-MM>/chaos/<formatid>-<elo>.json[.gz]
 * where <elo> is usually 0 for "all ratings" -- we want the widest sample,
 * not just top-ladder, since low/mid tiers matter for weaker species.)
 *
 * Usage:
 *   node scripts/buildItemPool.js [--month=YYYY-MM] [--top=6]
 *
 * If --month is omitted, it tries the current month, then walks backward
 * until it finds a month that actually has data published (stats for a
 * month are usually posted a day or two into the following month).
 */
const https = require('https');
const zlib = require('zlib');
const fs = require('fs');
const path = require('path');
const { toID } = require('pokemon-showdown');

// Spread of tiers chosen to cover as much of the National Dex as possible --
// a mon that's never seen in OU might still show up in UU/RU/NU/PU/ZU/LC.
const FORMATS = [
  'gen9nationaldex', 'gen9ou', 'gen9uu', 'gen9ru', 'gen9nu', 'gen9pu', 'gen9zu',
  'gen9ubers', 'gen9lc', 'gen9nfe', 'gen9monotype', 'gen9nationaldexuu',
  'gen9nationaldexmonotype',
];

function parseArgs() {
  const args = {};
  for (const arg of process.argv.slice(2)) {
    const m = arg.match(/^--([^=]+)=(.*)$/);
    if (m) args[m[1]] = m[2];
  }
  return args;
}

function fetchBuffer(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
      }
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    }).on('error', reject);
  });
}

async function fetchChaosJson(month, formatid) {
  // Try both compressed and uncompressed; availability of the plain .json
  // varies month to month on Smogon's server.
  const base = `https://www.smogon.com/stats/${month}/chaos/${formatid}-0`;
  try {
    const buf = await fetchBuffer(`${base}.json`);
    return JSON.parse(buf.toString('utf8'));
  } catch {
    const buf = await fetchBuffer(`${base}.json.gz`);
    const unzipped = zlib.gunzipSync(buf);
    return JSON.parse(unzipped.toString('utf8'));
  }
}

function monthsBack(startMonth, n) {
  const [y, m] = startMonth.split('-').map(Number);
  const out = [];
  let year = y, month = m;
  for (let i = 0; i < n; i++) {
    out.push(`${year}-${String(month).padStart(2, '0')}`);
    month--;
    if (month === 0) { month = 12; year--; }
  }
  return out;
}

async function findAvailableMonth(preferredMonth) {
  const now = new Date();
  const currentMonth = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
  const candidates = preferredMonth ? [preferredMonth] : monthsBack(currentMonth, 4);
  for (const month of candidates) {
    try {
      await fetchChaosJson(month, 'gen9ou'); // gen9ou always exists if the month has data
      return month;
    } catch { /* try older month */ }
  }
  throw new Error('Could not find a Smogon stats month with published gen9ou data in the last few months.');
}

async function main() {
  const args = parseArgs();
  const topN = parseInt(args.top || '6', 10);
  const month = await findAvailableMonth(args.month);
  console.log(`Using Smogon usage stats for ${month}`);

  // speciesId -> Map<itemId, totalWeightedCount>
  const itemCounts = new Map();

  for (const formatid of FORMATS) {
    let json;
    try {
      json = await fetchChaosJson(month, formatid);
    } catch (e) {
      console.warn(`  skipping ${formatid}: ${e.message}`);
      continue;
    }
    const data = json.data || {};
    for (const [speciesName, entry] of Object.entries(data)) {
      const speciesId = toID(speciesName);
      const items = entry.Items || {};
      if (!itemCounts.has(speciesId)) itemCounts.set(speciesId, new Map());
      const counts = itemCounts.get(speciesId);
      for (const [itemName, weight] of Object.entries(items)) {
        const itemId = toID(itemName);
        if (!itemId || itemId === 'nothing') continue;
        counts.set(itemId, (counts.get(itemId) || 0) + weight);
      }
    }
    console.log(`  merged ${formatid} (${Object.keys(data).length} species)`);
  }

  const result = {};
  for (const [speciesId, counts] of itemCounts.entries()) {
    const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, topN);
    if (sorted.length > 0) result[speciesId] = sorted.map(([itemId]) => itemId);
  }

  const outPath = path.join(__dirname, '..', 'data', 'common-items.json');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(result, null, 2));
  console.log(`Wrote common-items.json for ${Object.keys(result).length} species -> ${outPath}`);
}

main().catch(err => { console.error(err); process.exit(1); });

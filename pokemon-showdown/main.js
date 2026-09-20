'use strict';
const os = require('os');
const fs = require('fs');
const path = require('path');
const { Worker } = require('worker_threads');
const { loadPairsFromCsv } = require('./src/csvLoader');

function parseArgs() {
  const args = {};
  for (const arg of process.argv.slice(2)) {
    const m = arg.match(/^--([^=]+)=(.*)$/);
    if (m) args[m[1]] = m[2];
  }
  return args;
}

function pairKey(numA, numB) {
  return `${numA}:${numB}`;
}

/** Scan existing shard output files for pairs already completed, so a
 *  re-run after a crash/interrupt doesn't redo 5,000,000 battles. */
function loadCompletedKeys(outDir) {
  const done = new Set();
  if (!fs.existsSync(outDir)) return done;
  for (const f of fs.readdirSync(outDir)) {
    if (!f.endsWith('.jsonl')) continue;
    const lines = fs.readFileSync(path.join(outDir, f), 'utf8').split('\n').filter(Boolean);
    for (const line of lines) {
      try {
        const row = JSON.parse(line);
        if (row.numA !== undefined && row.numB !== undefined) {
          done.add(pairKey(row.numA, row.numB));
        }
      } catch { /* ignore partial/corrupt trailing line */ }
    }
  }
  return done;
}

function chunk(arr, n) {
  const out = Array.from({ length: n }, () => []);
  arr.forEach((item, i) => out[i % n].push(item));
  return out;
}

async function main() {
  const args = parseArgs();
  const csvPath = args.csv;
  if (!csvPath) {
    console.error('Usage: node main.js --csv=pairs.csv [--trials=50] [--workers=<cpus>] [--outDir=out] [--itemPool=data/common-items.json]');
    process.exit(1);
  }
  const trials = parseInt(args.trials || '50', 10);
  const workerCount = parseInt(args.workers || String(os.cpus().length), 10);
  const outDir = args.outDir || 'out';
  const itemPoolPath = args.itemPool || path.join(__dirname, 'data', 'common-items.json');

  fs.mkdirSync(outDir, { recursive: true });

  const allPairs = loadPairsFromCsv(csvPath);
  const completed = loadCompletedKeys(outDir);
  const remaining = allPairs.filter(([a, b]) => !completed.has(pairKey(a, b)));

  console.log(`Loaded ${allPairs.length} pairs (${completed.size} already done, ${remaining.length} remaining).`);
  if (remaining.length === 0) {
    console.log('Nothing to do.');
    return;
  }

  const shards = chunk(remaining, workerCount);
  const totalBattles = remaining.length * trials;
  let completedBattles = 0;
  const t0 = Date.now();

  await Promise.all(shards.map((shardPairs, i) => new Promise((resolve, reject) => {
    if (shardPairs.length === 0) return resolve();
    const outFile = path.join(outDir, `shard-${i}.jsonl`);
    const worker = new Worker(path.join(__dirname, 'worker.js'), {
      workerData: { pairs: shardPairs, outFile, trials, itemPoolPath },
    });
    worker.on('message', (msg) => {
      if (msg.type === 'progress') {
        completedBattles += trials;
        if (completedBattles % (trials * 50) === 0 || completedBattles === totalBattles) {
          const elapsedSec = (Date.now() - t0) / 1000;
          const rate = completedBattles / elapsedSec;
          const etaSec = (totalBattles - completedBattles) / rate;
          console.log(
            `${completedBattles}/${totalBattles} battles ` +
            `(${rate.toFixed(1)}/s, ETA ${(etaSec / 60).toFixed(1)} min)`
          );
        }
      }
    });
    worker.on('error', reject);
    worker.on('exit', (code) => code === 0 ? resolve() : reject(new Error(`worker ${i} exited with code ${code}`)));
  })));

  console.log(`Done. Results are in ${outDir}/shard-*.jsonl (one JSON object per pair per line).`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

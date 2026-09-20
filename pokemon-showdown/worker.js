'use strict';
const { parentPort, workerData } = require('worker_threads');
const fs = require('fs');
const { simulatePair } = require('./src/simulatePair');
const { loadItemPool } = require('./src/itemPool');

(async () => {
  const { pairs, outFile, trials, itemPoolPath } = workerData;
  const itemPool = loadItemPool(itemPoolPath); // null -> generic fallback pool everywhere

  const out = fs.createWriteStream(outFile, { flags: 'a' });

  for (const [numA, numB] of pairs) {
    try {
      const result = await simulatePair(numA, numB, itemPool, trials);
      out.write(JSON.stringify(result) + '\n');
    } catch (err) {
      // Record the failure instead of crashing the whole shard -- a single
      // bad dex number (typo in the source CSV) shouldn't lose the batch.
      out.write(JSON.stringify({ numA, numB, error: String(err.message || err) }) + '\n');
    }
    parentPort.postMessage({ type: 'progress' });
  }

  await new Promise(resolve => out.end(resolve));
  parentPort.postMessage({ type: 'done' });
})();

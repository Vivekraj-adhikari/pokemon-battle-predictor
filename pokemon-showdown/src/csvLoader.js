'use strict';
const fs = require('fs');

const A_NAMES = ['ida', 'id_a', 'a', 'pokemona', 'pokemon_a', 'dexa', 'dex_a', 'species_a', 'num_a', 'numa'];
const B_NAMES = ['idb', 'id_b', 'b', 'pokemonb', 'pokemon_b', 'dexb', 'dex_b', 'species_b', 'num_b', 'numb'];

function splitCsvLine(line) {
  // Simple split is fine here: this loader only ever expects two integer
  // columns, so no quoting/escaping logic is needed.
  return line.split(',').map(c => c.trim());
}

/**
 * Load [numA, numB] pairs from a CSV file.
 *
 * Accepts either:
 *   - A header row naming the two ID columns (case-insensitive; matches
 *     things like "id_a"/"idA"/"pokemon_a"/"dexA", or just any two columns
 *     if no recognizable header names are found -- see below), or
 *   - No header at all, with the two IDs in the first two columns.
 *
 * If the first row's first two cells both parse as integers, it's treated
 * as data (no header). Otherwise it's treated as a header row, and we look
 * for recognizable column names; if none match, we fall back to columns
 * 0 and 1 of the (assumed) header row.
 *
 * Throws with a descriptive message rather than silently mis-reading, since
 * a silent misread here would waste an entire 5,000,000-battle run.
 */
function loadPairsFromCsv(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  const lines = raw.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
  if (lines.length === 0) throw new Error(`${filePath} is empty`);

  let startIdx = 0;
  let colA = 0, colB = 1;

  const firstCells = splitCsvLine(lines[0]);
  const firstLooksNumeric = firstCells.length >= 2 &&
    Number.isInteger(Number(firstCells[0])) && Number.isInteger(Number(firstCells[1]));

  if (!firstLooksNumeric) {
    // Treat as header row.
    const header = firstCells.map(c => c.toLowerCase().replace(/[^a-z0-9_]/g, ''));
    const idxA = header.findIndex(h => A_NAMES.includes(h));
    const idxB = header.findIndex(h => B_NAMES.includes(h));
    if (idxA !== -1 && idxB !== -1) {
      colA = idxA;
      colB = idxB;
    } else {
      console.warn(
        `Could not recognize column names in header [${firstCells.join(', ')}]; ` +
        `defaulting to columns 0 and 1. Pass explicit column names if this is wrong.`
      );
    }
    startIdx = 1;
  }

  const pairs = [];
  for (let i = startIdx; i < lines.length; i++) {
    const cells = splitCsvLine(lines[i]);
    const numA = parseInt(cells[colA], 10);
    const numB = parseInt(cells[colB], 10);
    if (!Number.isInteger(numA) || !Number.isInteger(numB)) {
      throw new Error(`Row ${i + 1} of ${filePath} did not parse to two integers: "${lines[i]}"`);
    }
    pairs.push([numA, numB]);
  }
  return pairs;
}

module.exports = { loadPairsFromCsv };

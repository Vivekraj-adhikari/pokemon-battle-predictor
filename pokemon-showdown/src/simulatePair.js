'use strict';
const { getSpeciesByDexNum } = require('./dexUtils');
const { runOneBattle } = require('./battleRunner');

/**
 * Simulate `trials` independent battles for a pair of dex numbers, each
 * with freshly randomized EVs/nature/ability/item/moves for both sides.
 * Returns { numA, numB, trials, winsA, winsB, draws, winrateA }.
 */
async function simulatePair(numA, numB, itemPool, trials = 50) {
  const speciesA = getSpeciesByDexNum(numA);
  const speciesB = getSpeciesByDexNum(numB);

  let winsA = 0, winsB = 0, draws = 0;
  for (let i = 0; i < trials; i++) {
    const result = await runOneBattle(speciesA, speciesB, itemPool);
    if (result === 'A') winsA++;
    else if (result === 'B') winsB++;
    else draws++;
  }

  return {
    numA, numB, trials, winsA, winsB, draws,
    winrateA: winsA / trials,
  };
}

module.exports = { simulatePair };

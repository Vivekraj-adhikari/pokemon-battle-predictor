'use strict';
const { Dex } = require('pokemon-showdown');

// Lazily built once per process: dexNum -> Species
let _byNum = null;

/**
 * Resolve a National Dex number to a Species object, restricted to the
 * "base forme" of each species (Wormadam-Plant, not Wormadam-Sandy, etc.)
 * and to species that are part of the National Dex (i.e. not CAP fan-mons
 * and not one-off "Custom" entries).
 *
 * Important gotcha found while testing: `!species.isNonstandard` is NOT the
 * right filter for "National Dex". Pokemon-showdown tags every species that
 * isn't in Scarlet/Violet's *regional* dex (e.g. Caterpie, Onix, tons of
 * old mons) as isNonstandard: 'Past', even though they are fully legal and
 * playable in Gen 9 (via Pokemon HOME) and are exactly what Smogon's
 * "National Dex" tier allows. The correct National Dex filter is:
 *   isNonstandard === null || isNonstandard === 'Past'
 * excluding only 'CAP' and 'Custom'. Verified this gives exactly 1025
 * species (dex numbers 1-1025, no gaps).
 */
function buildIndex() {
  const map = new Map();
  for (const s of Dex.species.all()) {
    if (s.baseSpecies !== s.name) continue; // skip non-base formes
    if (s.isNonstandard !== null && s.isNonstandard !== 'Past') continue; // skip CAP/Custom
    if (!map.has(s.num)) map.set(s.num, s);
  }
  return map;
}

function getSpeciesByDexNum(num) {
  if (!_byNum) _byNum = buildIndex();
  const species = _byNum.get(num);
  if (!species) throw new Error(`No National Dex species found for dex number ${num}`);
  return species;
}

function nationalDexSize() {
  if (!_byNum) _byNum = buildIndex();
  return _byNum.size;
}

module.exports = { getSpeciesByDexNum, nationalDexSize, Dex };

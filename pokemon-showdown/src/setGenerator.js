'use strict';
const { Dex } = require('./dexUtils');

const ALL_NATURES = Dex.natures.all().map(n => n.name);
const STATS = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'];

// Fallback item pool used for species with no usage-stats entry
// (e.g. mons that see essentially no competitive play in any tier).
const DEFAULT_ITEM_POOL = [
  'leftovers', 'choicescarf', 'choiceband', 'choicespecs', 'lifeorb',
  'assaultvest', 'heavydutyboots', 'focussash', 'rockyhelmet', 'sitrusberry',
];

function shuffled(arr, rng) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Random ability from the species' legal ability slots (0 / 1 / H).
 *  Excludes slot 'S' (past/event-only abilities that are not obtainable
 *  going forward and would be a "trap" for a randomizer to pick). */
function pickRandomAbility(species, rng) {
  const pool = Object.entries(species.abilities)
    .filter(([slot]) => slot !== 'S')
    .map(([, name]) => name);
  return pool[Math.floor(rng() * pool.length)];
}

/** Random EV spread: each stat 0-252, total <= 508, multiples of 4
 *  (matches how EVs actually function in-game; anything not a multiple
 *  of 4 beyond the first point is wasted). */
function randomEVs(rng) {
  const evs = { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
  let remaining = 508;
  for (const stat of shuffled(STATS, rng)) {
    const max = Math.min(252, remaining);
    const steps = Math.floor(max / 4) + 1; // 0,4,8,...,max(rounded down to /4)
    const val = Math.floor(rng() * steps) * 4;
    evs[stat] = val;
    remaining -= val;
  }
  return evs;
}

function pickRandomNature(rng) {
  return ALL_NATURES[Math.floor(rng() * ALL_NATURES.length)];
}

/**
 * All moves the species can ever learn, across every generation's data.
 *
 * Deliberately NOT filtered down to "moves with a gen-9-tagged source".
 * Tested this against the actual learnset data: Showdown does not re-stamp
 * a move with a fresh "9L1" entry just because nothing about it changed,
 * so a strict "must have a gen-9 source" filter zeroes out huge parts of
 * the dex (e.g. Caterpie legitimately has 0 moves under that filter, which
 * is wrong -- it can still Tackle/String Shot/Bug Bite in Gen 9).
 * Taking the full historical learnset is the pragmatic choice for a
 * Monte-Carlo simulator like this; it is not a strict transfer-legality
 * check (that would require the full TeamValidator), but it never
 * produces an empty/near-empty movepool for a real species.
 */
function getFullMovepool(species) {
  const learnset = Dex.species.getLearnsetData(species.id)?.learnset || {};
  return Object.keys(learnset);
}

function pickRandomItem(itemPool, speciesId, rng) {
  const pool = (itemPool && itemPool[speciesId]) || DEFAULT_ITEM_POOL;
  return pool[Math.floor(rng() * pool.length)];
}

/**
 * Build one fully-randomized level-50 set for a species.
 * itemPool: optional { [speciesId]: string[] } loaded from data/common-items.json
 * rng: () => number in [0,1); pass a seeded PRNG for reproducibility if desired.
 */
function buildRandomSet(species, itemPool, rng = Math.random) {
  const movepool = shuffled(getFullMovepool(species), rng);
  const moveCount = Math.min(4, movepool.length);
  const set = {
    name: species.baseSpecies,
    species: species.name,
    item: pickRandomItem(itemPool, species.id, rng),
    ability: pickRandomAbility(species, rng),
    moves: movepool.slice(0, moveCount),
    nature: pickRandomNature(rng),
    evs: randomEVs(rng),
    ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 },
    level: 50,
  };
  // species.gender is '' for species that can be either M or F -- leave the
  // field out in that case and let the engine assign one, rather than the
  // bug of doing `species.gender || 'N'` (which wrongly forces Genderless).
  if (species.gender) set.gender = species.gender;
  return set;
}

module.exports = { buildRandomSet, DEFAULT_ITEM_POOL };

const { Dex } = require('pokemon-showdown');

function shuffled(arr, rng) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}


function pickRandomAbility(species, rng) {
    const pool = Object.entries(species.abilities)
        .filter(([slot]) => slot !== 'S')
        .map(([, name]) => name);
    return pool[Math.floor(rng() * pool.length)];
}


function randomEVs(rng) {
    const evs = { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
    let remaining = 508;
    for (const stat of shuffled(['hp', 'atk', 'def', 'spa', 'spd', 'spe'], rng)) {
        const max = Math.min(252, remaining);
        const steps = Math.floor(max / 4) + 1;
        const val = Math.floor(rng() * steps) * 4;
        evs[stat] = val;
        remaining -= val;
    }
    return evs;
}

function pickRandomNature(rng) {
    const natures = Dex.natures.all();
    return natures[Math.floor(rng() * natures.length)].name;
}

function getFullMovepool(species) {
    const learnset = Dex.species.getLearnsetData(species.id)?.learnset || {};
    return Object.keys(learnset);
}

function buildRandomSet(species, rng = Math.random) {
    const movepool = shuffled(getFullMovepool(species), rng);
    const set = {
        name: species.baseSpecies,
        species: species.name,
        level: 50,
        ability: pickRandomAbility(species, rng),
        item: 'leftovers',
        moves: movepool.slice(0, Math.min(4, movepool.length)),
        nature: pickRandomNature(rng),
        evs: randomEVs(rng),
        ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 },
    };
    if (species.gender) set.gender = species.gender;
    return set;
}

module.exports = { buildRandomSet, pickRandomAbility, randomEVs, pickRandomNature, getFullMovepool };
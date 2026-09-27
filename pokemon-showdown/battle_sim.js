const { Dex, toID, Battle } = require('pokemon-showdown')

const pikachu = {
    name: 'Sparky',           // nickname (cosmetic)
    species: 'Electivire',
    item: 'Light Ball',
    ability: 'Static',
    moves: ['Thunderbolt', 'Quick Attack', 'Iron Tail', 'Volt Switch'],  // up to 4
    nature: 'Timid',
    evs: { hp: 4, atk: 0, def: 0, spa: 252, spd: 0, spe: 252 },   // 0-252 each, 508 total max
    ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 },
    level: 50,
    gender: 'M',               // omit entirely for species that can be either -- see §10
}

const charizard = {
    name: 'Blaze',           // nickname (cosmetic)
    species: 'Venusaur',
    item: 'Leftovers',
    ability: 'Blaze',
    moves: ['Solar Beam', 'Sludge Bomb', 'Leaf Storm', 'Sunny Day'],  // up to 4
    nature: 'Modest',
    evs: { hp: 4, atk: 0, def: 0, spa: 252, spd: 0, spe: 252 },   // 0-252 each, 508 total max
    ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 },
    level: 50,
    gender: 'M',               // omit entirely for species that can be either -- see §10
}

const battle = new Battle({
    formatid: 'gen9customgame',
    p1: { name: 'A', team: [pikachu] },   // PokemonSet[] directly -- no Teams.pack needed here
    p2: { name: 'B', team: [charizard] },
});

battle.makeChoices('team 1', 'team 1');   // answer team preview for both sides at once
// let winnerCount = 0;
// for (let i = 0; i < 100; i++) {
//     while (!battle.ended) {
//         battle.makeChoices('move 1', 'move 1');
//     }

//     if (battle.winner === 'A') {
//         // Do something
//         winnerCount++;
//     }
// }

while (!battle.ended) {
    battle.makeChoices('move 1', 'move 1');
}
console.log(battle.winner);   // 'A', 'B', or '' for a tie
console.log(battle.turn);     // current/final turn number
console.log(battle.log);
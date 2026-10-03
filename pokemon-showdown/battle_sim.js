import pkg from 'pokemon-showdown';
import randomPlayer from 'pokemon-showdown/dist/sim/tools/random-player-ai.js';
import { buildRandomSet } from './randomize_sets.js';

const { RandomPlayerAI } = randomPlayer;

const { Dex, BattleStream, getPlayerStreams, Teams } = pkg;

let _byNum = null;
function getSpeciesByDexNum(num) {
    if (!_byNum) {
        _byNum = new Map();
        for (const s of Dex.species.all()) {
            if (s.baseSpecies !== s.name) continue;
            if (s.isNonstandard !== null && s.isNonstandard !== 'Past') continue;
            if (!_byNum.has(s.num)) _byNum.set(s.num, s);
        }
    }
    const species = _byNum.get(num);
    if (!species) throw new Error(`No species found for dex number ${num}`);
    return species;
}

const MAX_TURNS = 200;
async function runOneBattle(speciesA, speciesB) {
    const setA = buildRandomSet(speciesA);
    const setB = buildRandomSet(speciesB);
    const streams = getPlayerStreams(new BattleStream());
    new RandomPlayerAI(streams.p1).start();
    new RandomPlayerAI(streams.p2).start();
    streams.omniscient.write(
        `>start ${JSON.stringify({ formatid: 'gen9customgame' })}\n` +
        `>player p1 ${JSON.stringify({ name: 'A', team: Teams.pack([setA]) })}\n` +
        `>player p2 ${JSON.stringify({ name: 'B', team: Teams.pack([setB]) })}`
    );
    let winner = null, turns = 0;
    for await (const chunk of streams.omniscient) {
        if (/\|turn\|/.test(chunk) && ++turns > MAX_TURNS) break;
        const win = chunk.match(/\|win\|(.+)/);
        if (win) winner = win[1];
    }
    if (winner === 'A') return 'A';
    if (winner === 'B') return 'B';
    return 'draw';
}


async function simulatePair(numA, numB, trials = 50) {
    const speciesA = getSpeciesByDexNum(numA);
    const speciesB = getSpeciesByDexNum(numB);
    let winsA = 0, draws = 0;
    for (let i = 0; i < trials; i++) {
        const result = await runOneBattle(speciesA, speciesB);
        if (result === 'A') winsA++;
        else if (result === 'draw') draws++;
    }
    return { numA, numB, speciesA: speciesA.name, speciesB: speciesB.name, trials, winsA, draws, winrateA: winsA / trials };
}


async function main() {
    // Bulbasaur (1) vs Charmander (4), 20 randomized-build trials.
    const result = await simulatePair(527, 842, 100);
    console.log(result);
    console.log(`${result.speciesA} won ${(result.winrateA * 100).toFixed(0)}% of ${result.trials} randomized-build battles against ${result.speciesB}.`);
}
main();
export { getSpeciesByDexNum, runOneBattle, simulatePair, main };
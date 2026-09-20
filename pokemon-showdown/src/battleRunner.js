'use strict';
const { BattleStream, getPlayerStreams, Teams } = require('pokemon-showdown');
const { RandomPlayerAI } = require('pokemon-showdown/dist/sim/tools/random-player-ai');
const { buildRandomSet } = require('./setGenerator');

const FORMAT_ID = 'gen9customgame';
const MAX_TURNS = 200; // safety valve: customgame has no Endless Battle Clause

/**
 * Run one battle between freshly-randomized sets for speciesA and speciesB.
 * Returns 'A' | 'B' | 'draw'.
 */
async function runOneBattle(speciesA, speciesB, itemPool, rng = Math.random) {
  const setA = buildRandomSet(speciesA, itemPool, rng);
  const setB = buildRandomSet(speciesB, itemPool, rng);

  const streams = getPlayerStreams(new BattleStream());
  const p1 = new RandomPlayerAI(streams.p1);
  const p2 = new RandomPlayerAI(streams.p2);
  void p1.start();
  void p2.start();

  let winner = null;
  let turns = 0;

  void streams.omniscient.write(
    `>start ${JSON.stringify({ formatid: FORMAT_ID })}\n` +
    `>player p1 ${JSON.stringify({ name: 'A', team: Teams.pack([setA]) })}\n` +
    `>player p2 ${JSON.stringify({ name: 'B', team: Teams.pack([setB]) })}`
  );

  for await (const chunk of streams.omniscient) {
    if (/\|turn\|/.test(chunk)) {
      turns++;
      if (turns > MAX_TURNS) break; // treat as a draw
    }
    const win = chunk.match(/\|win\|(.+)/);
    if (win) winner = win[1];
  }

  if (winner === 'A') return 'A';
  if (winner === 'B') return 'B';
  return 'draw';
}

module.exports = { runOneBattle, FORMAT_ID, MAX_TURNS };

# pkmn-1v1-sim

Monte Carlo 1v1 Pokemon battle simulator built on the real `pokemon-showdown`
npm package. For each `(dexNumA, dexNumB)` pair from your CSV, it runs 50
independent battles, each with freshly randomized EVs / Nature / Ability /
Item / Moves for both sides, and reports `winrateA`.

Tested end-to-end against `pokemon-showdown@0.11.11` while building this.

## Setup

```bash
npm install
```

## (Optional but recommended) Build the common-items lookup

The simulator can hold every species to a generic competitive item pool
(Leftovers, Choice items, Life Orb, Assault Vest, etc.), or to items drawn
from real Smogon usage-stats data per species. To use real data:

```bash
npm run build-items
```

This fetches Smogon's public monthly usage stats (`smogon.com/stats`) across
a spread of tiers (OU/UU/RU/NU/PU/ZU/LC/Ubers/National Dex/...) so that mons
which only see play in lower tiers still get sensible items, and writes
`data/common-items.json`. **This needs real internet access** — it will not
run in a sandboxed/offline environment. If you skip this step, every species
just uses the generic fallback pool in `src/setGenerator.js`
(`DEFAULT_ITEM_POOL`) — the simulator still runs fine, just less
"meta-accurate" on items specifically.

## Run

Your CSV can have a header naming the ID columns (`id_a`/`id_b`,
`pokemon_a`/`pokemon_b`, `dex_a`/`dex_b`, etc. — see `src/csvLoader.js` for
the full recognized list) or no header at all, in which case the first two
columns are used. IDs are National Dex numbers (Bulbasaur = 1, ... up to
1025).

```bash
node main.js --csv=your-pairs.csv --trials=50 --workers=8 --outDir=out
```

- `--trials` battles per pair (default 50)
- `--workers` parallel worker threads (default: number of CPU cores)
- `--outDir` where result shards land, as `shard-N.jsonl` — one JSON object
  per pair per line: `{numA, numB, trials, winsA, winsB, draws, winrateA}`
- `--itemPool` path to the common-items JSON (default `data/common-items.json`)

Re-running the same command after a crash/Ctrl-C is safe and cheap: `main.js`
scans existing `shard-*.jsonl` files first and only simulates pairs that
aren't already in there.

A 5-pair, 5-trial smoke test: `npm test`.

## Design notes / things worth knowing before you run 100,000 pairs

**Scope**: National Dex, Gen 9 rules, all ~1025 species (1–1025, no gaps).
Getting this right took an actual bug fix: pokemon-showdown flags every
species not in Scarlet/Violet's *regional* dex (Caterpie, Onix, hundreds of
others) as `isNonstandard: 'Past'`, even though they're fully legal and
obtainable via Pokémon HOME in Gen 9. Filtering on `!isNonstandard` would
silently drop ~30% of the dex. `src/dexUtils.js` keeps `null` and `'Past'`
and excludes only `'CAP'`/`'Custom'` — verified this gives exactly the 1025
expected species.

**Movepool**: a set's 4 moves are drawn from every move the species has
*ever* been able to learn, not filtered to "has a Gen-9-tagged learn
source." That stricter filter looks more "correct" but isn't: Showdown's
data doesn't re-stamp unchanged moves with a fresh Gen 9 tag, so it falsely
zeroes out the movepool for plenty of real species (Caterpie, tested,
literally gets 0 moves under that filter). This is a deliberate
simplification, not full Smogon-legal team validation — good enough for a
randomized win-rate Monte Carlo, not a tournament team builder.

**In-battle decisions**: both sides use `RandomPlayerAI`, which ships with
the `pokemon-showdown` package itself (used in its own examples) and picks
a uniformly random legal move each turn. It's imported from
`pokemon-showdown/dist/sim/tools/random-player-ai`, an internal/undocumented
path per the package's own README — pin your `pokemon-showdown` version if
you update dependencies later, in case that path moves.

**Format**: `gen9customgame` — effectively no restrictions (no Species
Clause needed, since it's 1v1 anyway), and each set carries `level: 50`
directly rather than relying on a format-level level rule. Since
`customgame` has no Endless Battle Clause, `src/battleRunner.js` forces a
`draw` after 200 turns as a safety valve against a random 4-move set with no
way to ever knock the other Pokemon out.

**Performance**: benchmarked at ~28 battles/sec on a single core in this
environment (fully warmed up — the Dex loads once and is cached, so this is
steady-state throughput, not including that one-time startup cost).
100,000 pairs × 50 trials = 5,000,000 battles ≈ 50 core-hours. Scale that
by however many cores your machine has via `--workers` (e.g. ~6 hours on 8
cores, ~3 hours on 16) — benchmark on your actual hardware before committing
to the full run, since throughput depends on CPU speed.

## Files

```
main.js                 CLI entry point: loads CSV, shards work across workers, checkpoints
worker.js                worker_thread: simulates its shard of pairs, streams JSONL out
src/dexUtils.js          National Dex number -> Species resolution
src/setGenerator.js      randomized EVs / Nature / Ability / Item / Moves for one set
src/battleRunner.js      runs one BattleStream battle via RandomPlayerAI
src/simulatePair.js      runs `trials` battles for one pair, aggregates winrate
src/csvLoader.js         flexible CSV -> [numA, numB] pairs
src/itemPool.js          loads data/common-items.json (or null -> fallback pool)
scripts/buildItemPool.js one-time ETL from Smogon usage stats -> data/common-items.json
```

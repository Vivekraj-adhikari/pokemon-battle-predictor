# `pokemon-showdown` package reference

A from-scratch reference for building (and extending) a battle simulator on
top of the real `pokemon-showdown` npm package (tested against `v0.11.11`).

**How this was put together**: the package ships its own official docs
*inside* `node_modules/pokemon-showdown/` (not just on GitHub) plus full
TypeScript type declarations for everything it exports. This document is
built from both of those, and every claim that could be tested was tested
live rather than assumed — the "Pitfalls" section (§10) exists because
several reasonable-sounding assumptions turned out to be wrong.

---

## 1. Install, and what you actually get

```bash
npm install pokemon-showdown
```

- Main entry: `dist/sim/index.js`. Types: `dist/sim/index.d.ts`.
- `require('pokemon-showdown')` exports exactly this (from `sim/index.ts`):
  ```js
  { Battle, BattleStream, getPlayerStreams, Pokemon, PRNG, Side, Dex, toID, Teams, TeamValidator,
    /* + generic utilities re-exported from lib/: Streams, Utils, FS, Net, Dashycode, ProcessManager, Repl, SQL, crashlogger */ }
  ```
- **The package's own official docs are installed alongside the code** —
  worth knowing, since most people never look:
  ```
  node_modules/pokemon-showdown/sim/README.md          index of the three docs below
  node_modules/pokemon-showdown/sim/SIMULATOR.md        BattleStream / the >start protocol
  node_modules/pokemon-showdown/sim/SIM-PROTOCOL.md     every |message| the engine can send
  node_modules/pokemon-showdown/sim/TEAMS.md            team formats, Teams.*, TeamValidator
  node_modules/pokemon-showdown/sim/DEX.md              the Dex API
  node_modules/pokemon-showdown/sim/NONSTANDARD.md      isNonstandard tag meanings
  node_modules/pokemon-showdown/PROTOCOL.md             the client<->server chat/room protocol (not needed for a standalone simulator)
  node_modules/pokemon-showdown/COMMANDLINE.md          ./pokemon-showdown CLI (only if you clone the repo, not needed for npm usage)
  ```
- **Everything else is "undocumented"** — the package's own `sim/README.md`
  says so explicitly: it has TypeScript types for a lot more than the three
  documented APIs (Dex, Teams, BattleStream), but undocumented parts "should
  not be relied upon not to change" and aren't covered by semver. `Battle`
  used directly (§6), `RandomPlayerAI` (§5), and `PRNG` (§7) all fall in
  this bucket — genuinely useful, but pin your exact version if you depend
  on them.

---

## 2. The Dex — reference data

`Dex` answers "what do I know about this species/move/item/ability/nature"
— no battle involved yet.

```js
const { Dex, toID } = require('pokemon-showdown');

Dex.species.get('bulbasaur')   // -> Species object (name-insensitive to case/spacing)
Dex.moves.get('thunderbolt')   // -> Move object
Dex.items.get('leftovers')     // -> Item object
Dex.abilities.get('overgrow')  // -> Ability object
Dex.natures.get('adamant')     // -> Nature object

Dex.species.all()   // -> Species[], everything the package has data for
Dex.moves.all()     // -> Move[]
// .items.all(), .abilities.all() likewise

toID('Sludge Bomb')  // -> 'sludgebomb' -- normalizes a name to the internal ID form
```

`Dex` by itself gives the **latest generation** (currently Gen 9). For an
older generation's mechanics, use `Dex.mod(modId)`:

```js
Dex.mod('gen1').moves.get('tackle').basePower  // 35, not 40
```

### Species fields worth knowing (from `dist/sim/dex-species.d.ts`)

| Field | Meaning |
|---|---|
| `num` | National Dex number |
| `name` / `id` | Display name / normalized ID |
| `baseSpecies` / `forme` / `baseForme` | `baseSpecies === name` for the non-forme entry (e.g. base Wormadam vs `Wormadam-Sandy`) |
| `types` | `string[]`, e.g. `['Grass', 'Poison']` |
| `baseStats` | `{hp, atk, def, spa, spd, spe}` |
| `abilities` | `{0: primary, 1?: secondary, H?: hidden, S?: past/event-only}` |
| `gender` | `'M'`, `'F'`, `'N'` (genderless), or `''` (can be either — see §10) |
| `genderRatio` | `{M, F}` fractions, for species with a skewed-but-not-fixed ratio |
| `prevo` / `evos` / `nfe` | evolution-line info; `nfe` = "not fully evolved" |
| `tier` / `doublesTier` / `natDexTier` | Smogon tier placement |
| `isNonstandard` | see the table below — **this is the one to get right** |
| `exists` | `false` if the name didn't match anything at all (e.g. a typo) |

### `isNonstandard` — what each value actually means

Source: `sim/NONSTANDARD.md`, confirmed by testing.

| Value | Meaning |
|---|---|
| `null` | Standard — currently obtainable in this generation's own regional dex |
| `'CAP'` | Smogon's fan-made Create-A-Pokémon project (not a real species) |
| `'Custom'` | Made up for testing/hackmons purposes |
| `'Past'` | **Real, legal Pokémon, just not in the current game's own regional dex** (e.g. Caterpie isn't in Scarlet/Violet's Paldea dex, but is fully obtainable via Pokémon HOME and legal to battle with) |
| `'Future'` | Exists in a game generation that hasn't been released relative to the dex you're looking at |
| `'LGPE'` | Specific to Let's Go Pikachu/Eevee |
| `'Unobtainable'` | In the game's data files but never actually obtainable (unreleased events, hacking-only) |

**The trap**: `!species.isNonstandard` looks like "give me every real
species", but it silently excludes every `'Past'`-tagged species too —
which, verified by testing (§10), is hundreds of species including
Caterpie, Onix, and most of the Kanto/Johto/etc. dex that isn't in the
current game's own regional Pokédex. If you want the full **National Dex**,
keep `null` and `'Past'`, and exclude only `'CAP'` and `'Custom'`.

### Movesets: `Dex.species.getLearnsetData(id)`

```js
Dex.species.getLearnsetData('caterpie').learnset
// -> { tackle: ['8L1','8V','7L1','7V','6L1','5L1','4L1','3L1'], stringshot: [...], ... }
```

Each move maps to an array of "learned in Gen `N` via method `X`" tags
(`L1` = level 1, `M`/`T` = machine/tutor, `E` = egg move, `S` = event, `V`
= Virtual Console, etc). **Trap** (§10): the data does not re-stamp a move
with a fresh Gen 9 tag just because nothing changed about it — a move a
species has always been able to learn may have no `'9...'`-tagged entry at
all, even though it's obviously still usable. `Object.keys(learnset)` (every
move ever learnable) is the pragmatic move-pool source; a strict
"tagged for this exact gen" filter is not.

---

## 3. A "Set" — describing one Pokémon's build

A **set** is a plain object — there's no constructor, you just write it:

```js
{
  name: 'Sparky',           // nickname (cosmetic)
  species: 'Pikachu',
  item: 'Light Ball',
  ability: 'Static',
  moves: ['Thunderbolt', 'Quick Attack', 'Iron Tail', 'Volt Switch'],  // up to 4
  nature: 'Timid',
  evs: { hp: 4, atk: 0, def: 0, spa: 252, spd: 0, spe: 252 },   // 0-252 each, 508 total max
  ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 },
  level: 50,
  gender: 'M',               // omit entirely for species that can be either -- see §10
}
```

A **team** is just `PokemonSet[]`.

### Three formats for the same data (`sim/TEAMS.md`)

1. **JSON** — the object above. What you work with in code.
2. **Packed** — a compact, single-line string. What gets sent over the wire
   to `>player`. `Teams.pack(team)` / `Teams.unpack(packedString)`.
3. **Export** — the human-readable teambuilder text people paste on forums.
   `Teams.export(team)` / (`Teams.import(anyFormat)` reads any of the three).

```js
const { Teams } = require('pokemon-showdown');
Teams.pack([mySet])                 // -> packed string, for >player's "team" field
Teams.unpack(packedString)          // -> PokemonSet[]
Teams.export([mySet])               // -> human-readable text
Teams.exportSet(mySet)              // -> human-readable text, single set
Teams.generate('gen9randombattle')  // -> a random-format team generator's own PokemonSet[]
```

**Tested, undocumented-but-handy**: when constructing a `Battle` directly
(§6) or using `BattleOptions.p1.team` / `PlayerOptions.team`, you can pass
the raw `PokemonSet[]` array — `Teams.pack()` is only required when your
team has to cross the *text* protocol (`>player` written into a stream).

### `TeamValidator` — real legality checking

Separate from the battle engine. Useful if you want strictly Smogon-legal
sets instead of "every move it's ever learned":

```js
const { Teams, TeamValidator } = require('pokemon-showdown');
const validator = new TeamValidator('gen9ou');
const problems = validator.validateTeam([mySet]);  // -> string[] of problems, or null if legal
```

Tested with a deliberately illegal set (Pikachu with the Overgrow
ability): it correctly returned `"Pikachu can't have Overgrow."`. One
practical wrinkle found at the same time: validating a **level 50** set
against a format that expects level 100 (like standard `gen9ou`) adds a
*note* asking you to bump one EV by 1 to confirm the level was intentional
— not a hard error, but worth knowing if you're validating a 1v1-at-level-50
simulator's sets against a standard singles format.

---

## 4. Running a battle: the text protocol + `BattleStream`

The engine is a text-in/text-out stream: you write **choice commands**, it
writes back **protocol messages**. `sim/SIMULATOR.md` and
`sim/SIM-PROTOCOL.md` are the canonical sources; this section is the
condensed, verified version.

```js
const { BattleStream, getPlayerStreams, Teams } = require('pokemon-showdown');

const streams = getPlayerStreams(new BattleStream());
// streams.omniscient  -- sees everything (spectator with full info)
// streams.spectator   -- public view, no hidden info
// streams.p1 / .p2 / .p3 / .p4 -- each player's own private view+input channel

streams.omniscient.write(
  `>start ${JSON.stringify({ formatid: 'gen9customgame' })}\n` +
  `>player p1 ${JSON.stringify({ name: 'Alice', team: Teams.pack(team1) })}\n` +
  `>player p2 ${JSON.stringify({ name: 'Bob', team: Teams.pack(team2) })}`
);

for await (const chunk of streams.omniscient) {
  console.log(chunk);   // pipe-delimited protocol messages, one battle-event-group per chunk
}
```

### Setup commands (write to the **omniscient** stream, prefixed)

- `>start {"formatid": "...", "seed": [...] }` — begins the battle. `p1`
  team via `team` field can be a packed string, an export string, or a
  `PokemonSet[]`.
- `>player p1 {"name": "...", "team": "..."}` — sets up a player (if not
  already given inline to `>start`).

### Choice commands — **the prefix rule that's easy to get backwards**

Verified directly: `>p1 CHOICE` / `>p2 CHOICE` syntax (with the player-id
prefix) is for writing into the **shared/omniscient** stream, which routes
by prefix to the right player. If you instead write directly into that
player's **own** stream (`streams.p1`), you drop the prefix — just the bare
choice:

```js
streams.omniscient.write('>p1 move 1');   // on the shared stream: prefix required
streams.p1.write('move 1');               // on player 1's own stream: NO prefix
```

Mixing these up doesn't throw an error — it just silently does nothing,
which is a confusing way to discover the rule the hard way.

### Choice syntax (from `SIM-PROTOCOL.md`, "Possible choices")

| Choice | Meaning |
|---|---|
| `team TEAMSPEC` | Team Preview order, e.g. `team 1` (keep order) or `team 213456` (swap first two) |
| `move MOVESLOTSPEC` | Use a move — by name (`move Thunderbolt`) or 1-based slot (`move 1`) |
| `move MOVESLOTSPEC mega`/`zmove`/`max`/`terastallize` | Use a move while also Mega Evolving / using a Z-move / Dynamaxing / Terastallizing |
| `switch SWITCHSPEC` | Switch — by nickname/species or 1-based slot |
| `default` | Auto-pick the first legal choice |
| `pass` | Skip a slot that needs no decision (doubles/triples) |
| `undo` | Cancel a choice already made this turn, if the opponent hasn't acted yet |

In Doubles/Triples, comma-separate two choices and add a target slot
(`move Thunderbolt 1 mega, move Helping Hand -1`) — irrelevant for a 1v1
singles simulator, but worth knowing if you ever extend to multi-mon.

### Reading the output: message reference (curated; full list in `SIM-PROTOCOL.md`)

**Initialization** (before `|start`): `|player|P|NAME|AVATAR|RATING`,
`|teamsize|P|N`, `|gametype|...`, `|gen|N`, `|tier|NAME`, `|rule|...`
(one per active clause), team-preview block (`|clearpoke` / `|poke|...` /
`|teampreview`), then `|start`.

**Requests**: `|request|REQUEST` — a JSON payload (`REQUEST.active` = your
options this turn, `REQUEST.side` = your whole team's state) telling you
it's your turn to answer. This is what `RandomPlayerAI` (§5) parses for you
so you don't have to.

**Turn flow**: `|turn|N`, `|upkeep`, `|win|USER`, `|tie`, `|t:|TIMESTAMP`.

**Major actions**: `|move|POKEMON|MOVE|TARGET`, `|switch|POKEMON|DETAILS|HP STATUS`
(intentional) / `|drag|...` (forced, e.g. Whirlwind), `|faint|POKEMON`,
`|cant|POKEMON|REASON` (couldn't act — paralysis, Disable, etc).

**Minor actions** (the effects of the above): `|-damage|POKEMON|HP STATUS`,
`|-heal|...`, `|-status|POKEMON|STATUS`, `|-curestatus|...`,
`|-boost|POKEMON|STAT|AMOUNT` / `|-unboost|...`, `|-crit|POKEMON`,
`|-supereffective|POKEMON`, `|-resisted|POKEMON`, `|-miss|SOURCE|TARGET`,
`|-fail|POKEMON|ACTION`, `|-weather|WEATHER`, `|-sidestart|SIDE|CONDITION`
(Stealth Rock, Reflect, Tailwind, etc), `|-start|POKEMON|EFFECT` /
`|-end|...` (volatile status like confusion, Substitute, Taunt).

**Pokémon identity**: an ID is `POSITION: NICKNAME` (e.g. `p1a: Sparky`);
`DETAILS` alongside `|switch|` is `SPECIES, L##, GENDER, shiny` (level/gender/
shiny omitted when not applicable). `HP STATUS` is `CURRENT/MAX` for your
own side, `/100` (percentage) or `/48` for the opponent's, unless HP
Percentage Mod changes that.

---

## 5. Automating both sides: `BattlePlayer` and `RandomPlayerAI`

Manually answering every `|request|` (§4) for a whole battle is a lot of
typing. The package ships an abstract base and one concrete implementation
for this, at `dist/sim/battle-stream.d.ts` and
`dist/sim/tools/random-player-ai.js` respectively (the latter has no `.d.ts`
— it's a "tools" script, not part of the declared public API, but it's
literally what the package's own examples use).

```ts
abstract class BattlePlayer {
  constructor(playerStream: ObjectReadWriteStream<string>, debug?: boolean);
  start(): Promise<void>;                       // begins listening
  choose(choice: string): void;                 // writes a choice back
  abstract receiveRequest(request: ChoiceRequest): void;  // YOU implement this
  receiveError(error: Error): void;              // override to customize error handling
}
```

`RandomPlayerAI extends BattlePlayer` and implements `receiveRequest` for
you — parses team preview / forced-switch / move requests and picks a
uniformly random *legal* option. Construction:

```js
const { RandomPlayerAI } = require('pokemon-showdown/dist/sim/tools/random-player-ai');
new RandomPlayerAI(streams.p1, { move: 1, mega: 0, seed: undefined }, /* debug */ false).start();
```

- `move` (0-1, default 1): probability of choosing a move over switching
  when both are options. `1` = never voluntarily switch — irrelevant for a
  1v1 team of one, but matters for multi-mon teams.
- `mega` (0-1, default 0): probability of Mega Evolving/Dynamaxing/etc when
  available.
- `seed`: pass a `PRNGSeed` for reproducible random choices (§7).

### Extension point: override its decision hooks

`RandomPlayerAI` calls three small, overridable methods — this is the clean
way to build a smarter (or just different) AI without reimplementing all
the request-parsing logic:

```js
class MaxPowerPlayerAI extends RandomPlayerAI {
  // moves: [{choice: 'move 2', move: {slot, move: 'Flamethrower', target, zMove}}, ...]
  chooseMove(active, moves) {
    // Prefer the highest base-power move; RandomPlayerAI's default just
    // does `this.prng.sample(moves).choice`.
    const { Dex } = require('pokemon-showdown');
    const best = moves.reduce((a, b) =>
      Dex.moves.get(a.move.move).basePower >= Dex.moves.get(b.move.move).basePower ? a : b
    );
    return best.choice;
  }
  // chooseSwitch(active, switches) { ... }        // same idea, for forced switches
  // chooseTeamPreview(team) { return 'default'; }  // same idea, for team order
}
```

Tested: dropping `MaxPowerPlayerAI` in place of `RandomPlayerAI` for both
sides in the lesson-4-style loop runs correctly and always picks the
highest-`basePower` legal move each turn.

**Import-path caveat**: `random-player-ai` lives at an internal path with
no exported `.d.ts`, which is exactly the "undocumented API" the package's
README warns about — pin your `pokemon-showdown` version if you build on
it, in case the path or shape changes in a future release.

---

## 6. Advanced: using `Battle` directly (no stream at all)

`BattleStream` is a thin wrapper around a `Battle` object. You can use
`Battle` directly for **synchronous** control flow (no `async`/`await`,
no stream chunking):

```js
const { Battle } = require('pokemon-showdown');

const battle = new Battle({
  formatid: 'gen9customgame',
  p1: { name: 'A', team: [setA] },   // PokemonSet[] directly -- no Teams.pack needed here
  p2: { name: 'B', team: [setB] },
});

battle.makeChoices('team 1', 'team 1');   // answer team preview for both sides at once
while (!battle.ended) {
  battle.makeChoices('move 1', 'move 1');
}

console.log(battle.winner);   // 'A', 'B', or '' for a tie
console.log(battle.turn);     // current/final turn number
console.log(battle.log);      // string[] -- the exact same protocol messages BattleStream exposes
```

Key members (from `dist/sim/battle.d.ts`): `turn: number`, `ended: boolean`,
`winner?: string`, `log: string[]`, `sides: [Side, Side] | [...4]`,
`makeChoices(...inputs: string[]): void`, `choose(sideid, input): boolean`
(one side at a time), `win(side?)` / `tie()` / `forceWin(side?)` (force an
outcome, useful for testing).

**Tested performance finding**: it's tempting to assume skipping the
stream/async layer is meaningfully faster. Benchmarked both approaches
head-to-head (1000 battles each, with warmup) on the same fixed matchup:
**~2.6ms/battle direct vs ~2.4ms/battle via `BattleStream`** — statistically
a wash. The text-log generation happens inside `Battle` either way; the
stream is just thin queuing on top. **Reach for direct `Battle` for
synchronous control flow, not for speed** — the actual battle simulation
(event system, damage calculation) is the real cost either way, and no
public API skips that.

---

## 7. Reproducibility: `PRNG` and seeds

Pokémon Showdown re-implements the in-game RNG, which means a battle can be
replayed exactly given the same seed + same choices.

```js
const { PRNG } = require('pokemon-showdown');

const prng = new PRNG();          // random seed
prng.random();                    // float in [0, 1)
prng.random(6);                   // integer in [0, 6)
prng.randomChance(1, 4);          // true with probability 1/4
prng.sample(['a', 'b', 'c']);     // uniform pick
prng.shuffle(arr);                // in-place Fisher-Yates

const seed = PRNG.generateSeed();
new PRNG(seed);                   // deterministic: same seed -> same sequence
```

To make a whole **battle** reproducible, pass a seed to `>start`'s options
(`{"formatid": "...", "seed": [...]}`) or to `BattleOptions.seed` when
constructing `Battle` directly — same seed + same sequence of choices
reproduces the exact same battle log. `RandomPlayerAI`'s own `seed` option
(§5) controls only *that AI's* random choices, separately from the battle's
own RNG (crits, damage rolls, secondary effect chances, etc).

---

## 8. Formats & rules

A **format** (`formatid`, e.g. `'gen9customgame'`, `'gen9ou'`,
`'gen1randombattle'`) bundles a generation + a ruleset. A few things worth
knowing when picking one for a custom simulator:

- `gen9customgame` (and other `customgame` formats) impose almost no
  restrictions — no Species Clause, no tier bans — which is why it's a
  reasonable default for a non-standard simulator. It **does** default to
  Team Preview on, and does **not** include an Endless Battle Clause, so
  a pathological set (no way to ever knock the other side out) can loop
  forever — add your own turn cap when driving a battle programmatically.
- Level isn't set by the format unless you rely on a level-adjustment rule
  (as VGC-style formats do); setting `level` directly on each `PokemonSet`
  works regardless of format and is simpler for a fixed-level simulator.
- `Dex.formats.get(formatid)` returns the format's own data (rules, banlist,
  etc) if you need to inspect what a given format actually enforces.

---

## 9. Pitfalls found by testing, not by guessing

Every one of these looked like a reasonable assumption and was wrong,
caught only by actually running code:

1. **`!species.isNonstandard` is not "give me the National Dex."** It
   drops every `'Past'`-tagged species too — hundreds of them, including
   Caterpie and most of the early regional dexes. Keep `null` and `'Past'`;
   exclude only `'CAP'`/`'Custom'` (§2).

2. **A move's learnset data isn't re-tagged for a new generation just
   because nothing changed.** Filtering a movepool to "has a source tagged
   for the current gen" can zero out a real species' entire movepool
   (tested: Caterpie gets 0 moves under that filter). Use the species'
   *entire* historical learnset instead (§2).

3. **`species.gender || 'N'` silently breaks every dual-gender species.**
   `species.gender` is `''` (falsy) for any species that can be either M or
   F — `||` treats that the same as an actual `'N'` (genderless) and wrongly
   forces Genderless onto e.g. every Pikachu. Only set the `gender` field
   on a set when there's a real fixed value to set (§3).

4. **The `p1`/`p2` prefix on choice commands only applies to the shared
   stream.** Writing `>p1 move 1` directly into `streams.p1` does nothing
   (silently) — on a player's own stream, write the bare choice (`move 1`)
   (§4).

5. **Direct `Battle` usage isn't faster than `BattleStream`.** Benchmarked;
   effectively identical throughput. Don't switch to it chasing performance
   (§6) — switch to it (if at all) for synchronous control flow.

6. **Validating a level-50 set against a level-100 format isn't silently
   ignored.** `TeamValidator` adds a note asking you to nudge an EV by 1 to
   confirm the level was intentional (§3) — expected if you ever validate
   a fixed-level-50 simulator's sets against a standard format.

---

## 10. Where these concepts map onto an actual simulator project

If you're building (or reading) a project structured like the one this
reference was written alongside:

| Concept here | Where it's used |
|---|---|
| §2 Dex / `isNonstandard` filtering | dex-number -> species resolution |
| §2 `getLearnsetData` | random movepool generation |
| §3 `PokemonSet`, `Teams.pack` | building one randomized build |
| §4 `BattleStream`/`getPlayerStreams` | running one battle |
| §5 `RandomPlayerAI` | both sides' in-battle move choices |
| §4 turn cap workaround | safety valve against non-terminating battles |
| (orchestration, not package-specific) | CSV in, worker threads, checkpointing, CSV out |

---

## 11. Going further

- Full protocol spec: `node_modules/pokemon-showdown/sim/SIM-PROTOCOL.md`
- Full team-format spec: `node_modules/pokemon-showdown/sim/TEAMS.md`
- Full Dex spec: `node_modules/pokemon-showdown/sim/DEX.md`
- Type declarations for anything not covered here:
  `node_modules/pokemon-showdown/dist/sim/*.d.ts` (readable even without a
  TypeScript toolchain — they're just annotated signatures)
- The package's own GitHub repo: <https://github.com/smogon/pokemon-showdown>
- Undocumented-API update channel (per `sim/README.md`): the Pokémon
  Showdown dev Discord, linked from that README

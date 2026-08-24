# Autonomous Playtest Lab — MVP (Next.js)

A Next.js + TypeScript port of the Autonomous Playtest Lab MVP. Simulates
many games of a small worker-placement game ("Harvest Valley") played by
heuristic AI personas, statistically flags balance issues, then uses
Claude to explain *why* a flagged issue happened by narrating the actual
game log that produced it.

## What's implemented (MVP scope)

- **One hand-authored game**, not rulebook parsing. `lib/games/harvestValley.ts`
  defines a small 6-action worker-placement game via the generic schema in
  `lib/schema.ts`. Swap in a new `GameDefinition` to test a different game
  without touching the engine.
- **Three heuristic personas** (`lib/personas.ts`): `optimizer` (greedy
  value-maximizer), `novice` (weighted-random, thematic choices), `aggressive`
  (prioritizes denying scarce/contested action spaces). Decision functions,
  not LLM agents — that's what makes running hundreds of games cheap and fast
  enough to run on every request.
- **Batch simulation** (`lib/engine/simulate.ts` + `lib/engine/state.ts`):
  runs every combination of personas across seats, many times each, with a
  seeded RNG so any flagged game can be reproduced exactly.
- **Stats/outlier detection** (`lib/analysis/stats.ts`): flags dominant-strategy
  win rates, seat/turn-order advantage, dead or overused action spaces, and
  snowballing (halfway-point leader almost always winning).
- **LLM narration** (`lib/narration/narrate.ts`, called from `app/api/narrate`):
  for a flagged issue, pulls one representative game log and asks Claude to
  explain the specific turn sequence that caused it, plus one concrete
  rule-number lever to try.
- **UI** (`app/page.tsx`): configure player count / games per lineup, run a
  batch, see win-rate and action-usage bars, and expand any flagged issue
  into its narrated explanation.

## What's explicitly NOT built yet

- Rulebook/PDF ingestion — game definitions are hand-authored for now
- Video-style explanations — narration is text only
- More than 3 personas (rules-lawyer, AP-prone, etc.)
- Hidden information / bluffing mechanics
- Persisting batches — every run is in-memory, nothing is saved to a database

## Running locally

```bash
npm install
cp .env.example .env.local   # then add your ANTHROPIC_API_KEY
npm run dev
```

Open http://localhost:3000, set player count / games per lineup, and click
**Run batch**. Without `ANTHROPIC_API_KEY` set, simulation and stats still
run fully — the "Explain this" panel just prints the prompt that would have
been sent, so you can verify the rest of the pipeline for free.

## Deploying (e.g. via Rocket, or Vercel)

This is a standard Next.js App Router project — no special build steps.
1. Push this repo to GitHub.
2. Import it into your platform of choice.
3. Set the `ANTHROPIC_API_KEY` environment variable/secret in the platform's
   dashboard before your first deploy that needs narration.

## First real output (from testing this port)

A 405-game batch (3 personas × 3 seats, 15 games per lineup) immediately
surfaced the same issues as the original Python prototype, without any
tuning:

- Seat 0 won **65%** of games vs a 33% even baseline — a large advantage
  tied to how turn order rotates.
- `forest` (gather wood) was used in **54%** of all worker placements —
  a likely auto-pick.
- `build_barn` was used in only **~1-4%** of placements — its cost (4 grain
  for 3 VP) is weak relative to `build_hut` (3 wood + 1 gold for 2 VP).

## Suggested next steps

1. **Raise `gamesPerLineup`** in the UI once you're validating a real
   design — 20 is fast for iterating, 100+ reduces noise in win-rate stats.
2. **Author a second `GameDefinition`** with different mechanics (e.g. an
   auction or tile-drafting game) to confirm the engine/stats generalize
   beyond Harvest Valley's specific shape.
3. **Add a 4th persona** (e.g. `rules_lawyer`) once the 3-persona loop
   feels solid, alongside a downtime/turn-length metric to make it useful.
4. **Only then** revisit rulebook ingestion (PDF → GameDefinition) — it's
   the most expensive piece to build and the least validated as necessary.

## File map

```
app/page.tsx                  # UI — config, results, narration panel
app/api/simulate/route.ts     # runs a batch server-side, returns the report
app/api/narrate/route.ts      # narrates one flagged issue via Claude
lib/schema.ts                 # GameDefinition / ActionSpace types
lib/engine/state.ts           # GameState, turn loop, action resolution
lib/engine/simulate.ts        # batch runner across persona lineups
lib/engine/rng.ts             # seeded RNG (reproducible batches)
lib/games/harvestValley.ts    # the one hand-authored example game
lib/personas.ts               # Optimizer / Novice / Aggressive decision policies
lib/analysis/stats.ts         # outlier/balance-issue detection
lib/narration/narrate.ts      # Claude prompt + call (server-only)
```

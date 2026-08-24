/**
 * Harvest Valley — a minimal worker-placement game built to exercise the
 * simulation engine. 2-4 players, 6 rounds, 2 workers per player per round.
 *
 * Rules summary:
 *   - Forest: gather 2 wood (unlimited slots)
 *   - Field: gather 2 grain (unlimited slots)
 *   - Market: convert 2 wood -> 3 gold (1 slot)
 *   - Build Hut: spend 3 wood + 1 gold -> 2 VP (1 slot)
 *   - Build Barn: spend 4 grain -> 3 VP (1 slot)
 *   - Trade Post: gain 1 gold, no cost (unlimited slots — always-available fallback)
 *
 * Most VP after 6 rounds wins; ties broken by gold, then wood+grain.
 * Intentionally slightly imbalanced (Hut looks cheap relative to Barn) so
 * the MVP has something real to detect.
 */

import { GameDefinition } from "@/lib/schema";

export function buildHarvestValley(): GameDefinition {
  return {
    name: "Harvest Valley",
    minPlayers: 2,
    maxPlayers: 4,
    rounds: 6,
    workersPerRound: 2,
    startingResources: { wood: 0, grain: 0, gold: 1 },
    actionSpaces: [
      { id: "forest", name: "Forest", slots: 99, cost: {}, gain: { wood: 2 } },
      { id: "field", name: "Field", slots: 99, cost: {}, gain: { grain: 2 } },
      { id: "market", name: "Market", slots: 1, cost: { wood: 2 }, gain: { gold: 3 } },
      { id: "build_hut", name: "Build Hut", slots: 1, cost: { wood: 3, gold: 1 }, gain: { vp: 2 } },
      { id: "build_barn", name: "Build Barn", slots: 1, cost: { grain: 4 }, gain: { vp: 3 } },
      { id: "trade_post", name: "Trade Post", slots: 99, cost: {}, gain: { gold: 1 } },
    ],
  };
}

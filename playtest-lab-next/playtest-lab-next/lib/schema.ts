/**
 * Game definition schema.
 *
 * Generic enough to describe a family of simple worker-placement games
 * (one action space per worker, resources in/out, VP scoring) without
 * hardcoding a single game's rules into the engine.
 *
 * For the MVP we hand-author one GameDefinition (see games/harvestValley.ts)
 * instead of parsing it from a rulebook PDF. Rulebook ingestion is a
 * separate, much harder problem — out of scope until this loop proves useful.
 */

export type ResourceMap = Record<string, number>;

export interface ActionSpace {
  id: string;
  name: string;
  slots: number; // how many workers can occupy this space in a round
  cost: ResourceMap; // e.g. { wood: 3, gold: 1 }
  gain: ResourceMap; // e.g. { wood: 2 } or { vp: 2 }
}

export interface GameDefinition {
  name: string;
  minPlayers: number;
  maxPlayers: number;
  rounds: number;
  workersPerRound: number;
  startingResources: ResourceMap;
  actionSpaces: ActionSpace[];
}

export function isAffordable(space: ActionSpace, resources: ResourceMap): boolean {
  return Object.entries(space.cost).every(([k, v]) => (resources[k] ?? 0) >= v);
}

export function actionById(game: GameDefinition, id: string): ActionSpace {
  const space = game.actionSpaces.find((a) => a.id === id);
  if (!space) throw new Error(`No action space with id ${id}`);
  return space;
}

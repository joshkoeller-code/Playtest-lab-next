import { GameDefinition, ResourceMap, actionById, isAffordable } from "@/lib/schema";
import { makeRng } from "@/lib/engine/rng";
import type { Persona, PersonaName } from "@/lib/personas";

export interface PlayerState {
  id: number;
  personaName: PersonaName;
  resources: ResourceMap;
  vp: number;
  workersRemaining: number;
}

export interface LogEvent {
  round: number;
  player: number;
  persona: PersonaName;
  action: string;
  resourcesAfter: ResourceMap;
  vpAfter: number;
}

export interface GameState {
  gameDef: GameDefinition;
  players: PlayerState[];
  round: number;
  occupied: Record<string, number[]>; // actionId -> player ids this round
  log: LogEvent[];
}

export function openSlots(state: GameState, actionId: string): number {
  const space = actionById(state.gameDef, actionId);
  const taken = state.occupied[actionId]?.length ?? 0;
  return space.slots - taken;
}

export function legalActions(state: GameState, player: PlayerState): string[] {
  const legal: string[] = [];
  for (const space of state.gameDef.actionSpaces) {
    if (openSlots(state, space.id) > 0 && isAffordable(space, player.resources)) {
      legal.push(space.id);
    }
  }
  return legal;
}

function newGameState(gameDef: GameDefinition, personas: Persona[]): GameState {
  const players: PlayerState[] = personas.map((p, i) => ({
    id: i,
    personaName: p.name,
    resources: { ...gameDef.startingResources },
    vp: 0,
    workersRemaining: 0,
  }));
  return { gameDef, players, round: 0, occupied: {}, log: [] };
}

function applyAction(state: GameState, player: PlayerState, actionId: string) {
  const space = actionById(state.gameDef, actionId);

  for (const [resource, amount] of Object.entries(space.cost)) {
    player.resources[resource] -= amount;
  }
  for (const [resource, amount] of Object.entries(space.gain)) {
    if (resource === "vp") {
      player.vp += amount;
    } else {
      player.resources[resource] = (player.resources[resource] ?? 0) + amount;
    }
  }

  (state.occupied[actionId] ??= []).push(player.id);
  state.log.push({
    round: state.round,
    player: player.id,
    persona: player.personaName,
    action: actionId,
    resourcesAfter: { ...player.resources },
    vpAfter: player.vp,
  });
}

export function runGame(gameDef: GameDefinition, personas: Persona[], seed: number): GameState {
  const rng = makeRng(seed);
  const state = newGameState(gameDef, personas);

  for (let roundNum = 1; roundNum <= gameDef.rounds; roundNum++) {
    state.round = roundNum;
    state.occupied = {};
    for (const p of state.players) p.workersRemaining = gameDef.workersPerRound;

    // Turn order rotates each round so no single player always goes first —
    // first-player advantage is exactly what this tool should be able to catch.
    const offset = roundNum % state.players.length;
    const order = [...state.players.slice(offset), ...state.players.slice(0, offset)];

    let placing = true;
    while (placing) {
      placing = false;
      for (const player of order) {
        if (player.workersRemaining <= 0) continue;
        const legal = legalActions(state, player);
        if (legal.length === 0) {
          player.workersRemaining -= 1;
          state.log.push({
            round: state.round,
            player: player.id,
            persona: player.personaName,
            action: "PASS_NO_LEGAL_MOVE",
            resourcesAfter: { ...player.resources },
            vpAfter: player.vp,
          });
          placing = placing || state.players.some((p) => p.workersRemaining > 0);
          continue;
        }
        const persona = personas[player.id];
        const choice = persona.chooseAction(state, player, legal, rng);
        applyAction(state, player, choice);
        player.workersRemaining -= 1;
        placing = placing || state.players.some((p) => p.workersRemaining > 0);
      }
    }
  }

  return state;
}

export function winner(state: GameState): number {
  const key = (p: PlayerState) =>
    p.vp * 1_000_000 + (p.resources.gold ?? 0) * 1000 + ((p.resources.wood ?? 0) + (p.resources.grain ?? 0));
  return state.players.reduce((best, p) => (key(p) > key(best) ? p : best)).id;
}

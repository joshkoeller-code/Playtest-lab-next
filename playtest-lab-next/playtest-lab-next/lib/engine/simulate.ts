import { GameDefinition } from "@/lib/schema";
import { runGame, winner, LogEvent } from "@/lib/engine/state";
import { PERSONA_REGISTRY, PersonaName } from "@/lib/personas";

export interface GameResult {
  lineup: PersonaName[];
  seed: number;
  winnerId: number;
  winnerPersona: PersonaName;
  finalVp: number[];
  log: LogEvent[];
}

/** All ordered combinations (with repetition) of personas for a given player count. */
function personaCombinations(numPlayers: number, personaNames: PersonaName[]): PersonaName[][] {
  if (numPlayers === 0) return [[]];
  const rest = personaCombinations(numPlayers - 1, personaNames);
  const out: PersonaName[][] = [];
  for (const name of personaNames) {
    for (const r of rest) out.push([name, ...r]);
  }
  return out;
}

export function runBatch(
  gameDef: GameDefinition,
  numPlayers: number,
  personaNames: PersonaName[],
  gamesPerLineup: number,
  seedStart = 0
): GameResult[] {
  const results: GameResult[] = [];
  let seed = seedStart;

  for (const lineup of personaCombinations(numPlayers, personaNames)) {
    const personas = lineup.map((name) => PERSONA_REGISTRY[name]);
    for (let i = 0; i < gamesPerLineup; i++) {
      const state = runGame(gameDef, personas, seed);
      const w = winner(state);
      results.push({
        lineup,
        seed,
        winnerId: w,
        winnerPersona: state.players[w].personaName,
        finalVp: state.players.map((p) => p.vp),
        log: state.log,
      });
      seed += 1;
    }
  }
  return results;
}

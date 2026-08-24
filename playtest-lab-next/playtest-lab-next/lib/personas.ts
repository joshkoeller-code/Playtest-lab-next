/**
 * Personas are decision policies, not chat agents. Heuristic functions —
 * this is what lets a batch run hundreds/thousands of games cheaply. The
 * one place an LLM actually gets involved is narration (lib/narration),
 * which explains a handful of *flagged* games in natural language.
 */

import { GameDefinition, actionById } from "@/lib/schema";
import { GameState, PlayerState } from "@/lib/engine/state";
import { choice } from "@/lib/engine/rng";

export type PersonaName = "optimizer" | "novice" | "aggressive";

export interface Persona {
  name: PersonaName;
  chooseAction(state: GameState, player: PlayerState, legal: string[], rng: () => number): string;
}

function actionValue(game: GameDefinition, actionId: string): number {
  const space = actionById(game, actionId);
  let value = 0;
  for (const [resource, amount] of Object.entries(space.gain)) {
    value += resource === "vp" ? amount * 3.0 : resource === "gold" ? amount * 1.0 : amount * 0.6;
  }
  for (const [resource, amount] of Object.entries(space.cost)) {
    value -= resource === "gold" ? amount * 1.0 : amount * 0.6;
  }
  return value;
}

/** 'Euro optimizer' — greedy value-maximizer, no lookahead. */
export const OptimizerPersona: Persona = {
  name: "optimizer",
  chooseAction(state, _player, legal) {
    const scored = legal.map((a) => [a, actionValue(state.gameDef, a)] as const);
    scored.sort((a, b) => b[1] - a[1]);
    return scored[0][0];
  },
};

/** New-to-hobby / casual family gamer — thematic, weighted-random choices. */
export const NovicePersona: Persona = {
  name: "novice",
  chooseAction(_state, _player, legal, rng) {
    const preferredOrder = ["forest", "field", "trade_post", "build_hut", "build_barn", "market"];
    const weighted: string[] = [];
    for (const a of legal) {
      const rank = preferredOrder.includes(a) ? preferredOrder.indexOf(a) : preferredOrder.length;
      const weight = Math.max(1, preferredOrder.length - rank);
      for (let i = 0; i < weight; i++) weighted.push(a);
    }
    return choice(rng, weighted);
  },
};

/** Prioritizes denying scarce/contested spaces to opponents over pure self-value. */
export const AggressivePersona: Persona = {
  name: "aggressive",
  chooseAction(state, _player, legal) {
    const scored = legal.map((a) => {
      const space = actionById(state.gameDef, a);
      const base = actionValue(state.gameDef, a);
      const scarcityBonus = space.slots <= 1 ? 5.0 : 0.0;
      return [a, base + scarcityBonus] as const;
    });
    scored.sort((a, b) => b[1] - a[1]);
    return scored[0][0];
  },
};

export const PERSONA_REGISTRY: Record<PersonaName, Persona> = {
  optimizer: OptimizerPersona,
  novice: NovicePersona,
  aggressive: AggressivePersona,
};

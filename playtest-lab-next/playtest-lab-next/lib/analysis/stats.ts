import { GameDefinition } from "@/lib/schema";
import { GameResult } from "@/lib/engine/simulate";
import { PersonaName } from "@/lib/personas";

export type IssueType =
  | "dominant_strategy"
  | "seat_advantage"
  | "dead_mechanic"
  | "overused_action"
  | "snowballing";

export interface Issue {
  type: IssueType;
  detail: string;
  [key: string]: unknown;
}

export interface BalanceReport {
  numGames: number;
  personaWinRate: Record<string, number>;
  seatWinRate: Record<string, number>;
  actionUsageShare: Record<string, number>;
  issues: Issue[];
}

const round3 = (n: number) => Math.round(n * 1000) / 1000;

export function analyze(results: GameResult[], gameDef: GameDefinition): BalanceReport {
  const issues: Issue[] = [];

  // --- 1. Win rate by persona (dominant strategy) ---
  const personaNames = Array.from(new Set(results.flatMap((r) => r.lineup)));
  const personaWinRate: Record<string, number> = {};
  for (const name of personaNames) {
    const opportunities = results.filter((r) => r.lineup.includes(name)).length;
    const wins = results.filter((r) => r.winnerPersona === name).length;
    personaWinRate[name] = opportunities ? wins / opportunities : 0;
  }
  const baseline = personaNames.length ? 1 / personaNames.length : 0;
  for (const [name, rate] of Object.entries(personaWinRate)) {
    if (rate > baseline * 1.5) {
      issues.push({
        type: "dominant_strategy",
        persona: name,
        winRate: round3(rate),
        baseline: round3(baseline),
        detail: `'${name}' wins ${(rate * 100).toFixed(0)}% of eligible games vs an even ${(baseline * 100).toFixed(0)}% baseline.`,
      });
    }
  }

  // --- 2. Seat/turn-order advantage ---
  const seatWins: Record<number, number> = {};
  const seatGames: Record<number, number> = {};
  for (const r of results) {
    for (let seat = 0; seat < r.lineup.length; seat++) {
      seatGames[seat] = (seatGames[seat] ?? 0) + 1;
    }
    seatWins[r.winnerId] = (seatWins[r.winnerId] ?? 0) + 1;
  }
  const seatWinRate: Record<string, number> = {};
  for (const seat of Object.keys(seatGames)) {
    const s = Number(seat);
    seatWinRate[seat] = (seatWins[s] ?? 0) / seatGames[s];
  }
  const seatRates = Object.values(seatWinRate);
  if (seatRates.length) {
    const avg = seatRates.reduce((a, b) => a + b, 0) / seatRates.length;
    for (const [seat, rate] of Object.entries(seatWinRate)) {
      if (rate > avg * 1.4) {
        issues.push({
          type: "seat_advantage",
          seat: Number(seat),
          winRate: round3(rate),
          average: round3(avg),
          detail: `Seat ${seat} wins ${(rate * 100).toFixed(0)}% of games vs a ${(avg * 100).toFixed(0)}% average across seats.`,
        });
      }
    }
  }

  // --- 3. Action space usage (dead mechanics / overused actions) ---
  const actionCounts: Record<string, number> = {};
  let totalActions = 0;
  for (const r of results) {
    for (const event of r.log) {
      if (event.action !== "PASS_NO_LEGAL_MOVE") {
        actionCounts[event.action] = (actionCounts[event.action] ?? 0) + 1;
        totalActions += 1;
      }
    }
  }
  const actionIds = gameDef.actionSpaces.map((a) => a.id);
  const evenShare = actionIds.length ? 1 / actionIds.length : 0;
  const actionUsageShare: Record<string, number> = {};
  for (const actionId of actionIds) {
    const share = totalActions ? (actionCounts[actionId] ?? 0) / totalActions : 0;
    actionUsageShare[actionId] = round3(share);
    if (share < evenShare * 0.25) {
      issues.push({
        type: "dead_mechanic",
        action: actionId,
        usageShare: round3(share),
        detail: `'${actionId}' is used in only ${(share * 100).toFixed(1)}% of all worker placements — likely a dead or trap option.`,
      });
    } else if (share > evenShare * 2.5) {
      issues.push({
        type: "overused_action",
        action: actionId,
        usageShare: round3(share),
        detail: `'${actionId}' accounts for ${(share * 100).toFixed(1)}% of all worker placements — may be a must-take auto-pick.`,
      });
    }
  }

  // --- 4. Snowballing: halfway-point VP leader vs eventual winner ---
  let snowballHits = 0;
  let snowballOpportunities = 0;
  for (const r of results) {
    const maxRound = Math.max(...r.log.map((e) => e.round));
    const halfRound = Math.floor(maxRound / 2);
    const vpAtHalf: Record<number, number> = {};
    for (const event of r.log) {
      if (event.round <= halfRound) vpAtHalf[event.player] = event.vpAfter;
    }
    const entries = Object.entries(vpAtHalf);
    if (entries.length === 0) continue;
    const leaderAtHalf = Number(entries.reduce((a, b) => (b[1] > a[1] ? b : a))[0]);
    snowballOpportunities += 1;
    if (leaderAtHalf === r.winnerId) snowballHits += 1;
  }
  const snowballRate = snowballOpportunities ? snowballHits / snowballOpportunities : 0;
  if (snowballRate > 0.75) {
    issues.push({
      type: "snowballing",
      rate: round3(snowballRate),
      detail: `The halfway-point VP leader goes on to win ${(snowballRate * 100).toFixed(0)}% of games — comebacks are rare.`,
    });
  }

  return {
    numGames: results.length,
    personaWinRate: Object.fromEntries(Object.entries(personaWinRate).map(([k, v]) => [k, round3(v)])),
    seatWinRate: Object.fromEntries(Object.entries(seatWinRate).map(([k, v]) => [k, round3(v)])),
    actionUsageShare,
    issues,
  };
}

export function pickOutlierGame(results: GameResult[], issue: Issue): GameResult | null {
  let candidates: GameResult[];
  if (issue.type === "dominant_strategy") {
    candidates = results.filter((r) => r.winnerPersona === (issue.persona as PersonaName));
  } else if (issue.type === "seat_advantage") {
    candidates = results.filter((r) => r.winnerId === (issue.seat as number));
  } else {
    candidates = results;
  }
  return candidates[0] ?? null;
}

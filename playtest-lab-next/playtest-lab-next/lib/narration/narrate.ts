/**
 * Turns a flagged statistical issue + its representative game log into a
 * readable explanation of *why* it happened, citing specific turns.
 *
 * This is the only place in the app that calls an LLM — simulation and
 * stats are cheap and run entirely client-request-side in the API route,
 * so narration budget is spent only on the handful of games that matter.
 *
 * Server-only: imported from app/api/narrate/route.ts, never from a
 * client component, so ANTHROPIC_API_KEY never reaches the browser.
 */

import Anthropic from "@anthropic-ai/sdk";
import { GameDefinition } from "@/lib/schema";
import { Issue } from "@/lib/analysis/stats";
import { GameResult } from "@/lib/engine/simulate";

function formatLogForPrompt(log: GameResult["log"], maxEvents = 200): string {
  return log
    .slice(0, maxEvents)
    .map(
      (e) =>
        `R${e.round} | P${e.player} (${e.persona}) -> ${e.action} | resources=${JSON.stringify(
          e.resourcesAfter
        )} vp=${e.vpAfter}`
    )
    .join("\n");
}

export function buildPrompt(gameDef: GameDefinition, issue: Issue, result: GameResult): string {
  const logText = formatLogForPrompt(result.log);
  const actionSummary = gameDef.actionSpaces
    .map((a) => `- ${a.id}: cost=${Object.keys(a.cost).length ? JSON.stringify(a.cost) : "none"}, gain=${JSON.stringify(a.gain)}`)
    .join("\n");

  return `You are a board game design analyst. A simulated playtest batch of
"${gameDef.name}" flagged a balance issue. Explain WHY it happened by
walking through the specific game log below — cite actual turn numbers
and player actions, don't speak in generalities.

FLAGGED ISSUE:
${JSON.stringify(issue, null, 2)}

GAME RULES (action spaces):
${actionSummary}

REPRESENTATIVE GAME LOG (lineup: ${JSON.stringify(result.lineup)}, winner: player ${result.winnerId} / ${result.winnerPersona}, final VP: ${JSON.stringify(result.finalVp)}):
${logText}

Write a short explanation (150-250 words) a designer could read to understand
the root cause. Structure:
1. What happened (the pattern, with specific turn references)
2. Why the rules allowed it (which cost/gain numbers make it possible)
3. One concrete lever the designer could adjust to test a fix (e.g. "raise
   Build Hut's gold cost to 2" — reference the actual action space and numbers)
Do not invent turns or numbers that aren't in the log or rules above.`;
}

export async function narrateIssue(
  gameDef: GameDefinition,
  issue: Issue,
  result: GameResult | null,
  model = "claude-sonnet-4-5"
): Promise<string> {
  if (!result) return "No representative game found for this issue.";

  const prompt = buildPrompt(gameDef, issue, result);

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return (
      "[ANTHROPIC_API_KEY not set — add it as an environment variable/secret in your deployment.]\n\n" +
      "--- Prompt that would have been sent ---\n" +
      prompt
    );
  }

  const client = new Anthropic({ apiKey });
  const response = await client.messages.create({
    model,
    max_tokens: 500,
    messages: [{ role: "user", content: prompt }],
  });

  return response.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("");
}

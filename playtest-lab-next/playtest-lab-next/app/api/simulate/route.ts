import { NextRequest, NextResponse } from "next/server";
import { buildHarvestValley } from "@/lib/games/harvestValley";
import { runBatch } from "@/lib/engine/simulate";
import { analyze } from "@/lib/analysis/stats";
import { PersonaName } from "@/lib/personas";

export const maxDuration = 30;

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));

  const numPlayers: number = body.numPlayers ?? 3;
  const gamesPerLineup: number = Math.min(body.gamesPerLineup ?? 20, 100);
  const personaNames: PersonaName[] = body.personaNames ?? ["optimizer", "novice", "aggressive"];

  if (numPlayers < 2 || numPlayers > 4) {
    return NextResponse.json({ error: "numPlayers must be between 2 and 4" }, { status: 400 });
  }

  const gameDef = buildHarvestValley();
  const results = runBatch(gameDef, numPlayers, personaNames, gamesPerLineup);
  const report = analyze(results, gameDef);

  return NextResponse.json({ report, results });
}

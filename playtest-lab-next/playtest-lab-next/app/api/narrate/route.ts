import { NextRequest, NextResponse } from "next/server";
import { buildHarvestValley } from "@/lib/games/harvestValley";
import { narrateIssue } from "@/lib/narration/narrate";
import { Issue } from "@/lib/analysis/stats";
import { GameResult } from "@/lib/engine/simulate";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const issue: Issue | undefined = body.issue;
  const result: GameResult | null = body.result ?? null;

  if (!issue) {
    return NextResponse.json({ error: "issue is required" }, { status: 400 });
  }

  const gameDef = buildHarvestValley();
  const narrative = await narrateIssue(gameDef, issue, result);

  return NextResponse.json({ narrative });
}

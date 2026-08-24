"use client";

import { useState } from "react";
import type { BalanceReport, Issue } from "@/lib/analysis/stats";
import type { GameResult } from "@/lib/engine/simulate";

interface SimulateResponse {
  report: BalanceReport;
  results: GameResult[];
}

const ISSUE_STYLE: Record<string, { border: string; label: string; tint: string }> = {
  dominant_strategy: { border: "border-brick", label: "DOMINANT STRATEGY", tint: "text-brick" },
  seat_advantage: { border: "border-amber", label: "SEAT ADVANTAGE", tint: "text-amber" },
  dead_mechanic: { border: "border-brick", label: "DEAD MECHANIC", tint: "text-brick" },
  overused_action: { border: "border-amber", label: "OVERUSED ACTION", tint: "text-amber" },
  snowballing: { border: "border-teal", label: "SNOWBALLING", tint: "text-teal" },
};

function BarRow({ label, value, max = 1 }: { label: string; value: number; max?: number }) {
  const pct = Math.min(100, (value / max) * 100);
  return (
    <div className="flex items-center gap-3 py-1.5">
      <span className="w-24 shrink-0 font-mono text-xs text-muted truncate">{label}</span>
      <div className="flex-1 h-2 bg-rule/60 rounded-sm overflow-hidden">
        <div className="h-full bg-teal" style={{ width: `${pct}%` }} />
      </div>
      <span className="w-12 shrink-0 font-mono text-xs text-parchment text-right">
        {(value * 100).toFixed(0)}%
      </span>
    </div>
  );
}

function issueRepresentativeGame(results: GameResult[], issue: Issue): GameResult | null {
  if (issue.type === "dominant_strategy") {
    return results.find((r) => r.winnerPersona === issue.persona) ?? null;
  }
  if (issue.type === "seat_advantage") {
    return results.find((r) => r.winnerId === issue.seat) ?? null;
  }
  return results[0] ?? null;
}

export default function Home() {
  const [numPlayers, setNumPlayers] = useState(3);
  const [gamesPerLineup, setGamesPerLineup] = useState(20);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<SimulateResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [narrating, setNarrating] = useState<string | null>(null);
  const [narratives, setNarratives] = useState<Record<string, string>>({});
  const [openIssueKey, setOpenIssueKey] = useState<string | null>(null);

  async function runSimulation() {
    setLoading(true);
    setError(null);
    setData(null);
    setNarratives({});
    setOpenIssueKey(null);
    try {
      const res = await fetch("/api/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          numPlayers,
          gamesPerLineup,
          personaNames: ["optimizer", "novice", "aggressive"],
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Simulation failed");
      const json: SimulateResponse = await res.json();
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function explainIssue(issue: Issue, key: string) {
    if (!data) return;
    setOpenIssueKey(key);
    if (narratives[key]) return;
    setNarrating(key);
    try {
      const representative = issueRepresentativeGame(data.results, issue);
      const res = await fetch("/api/narrate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ issue, result: representative }),
      });
      const json = await res.json();
      setNarratives((prev) => ({ ...prev, [key]: json.narrative ?? "No explanation returned." }));
    } catch {
      setNarratives((prev) => ({ ...prev, [key]: "Failed to reach the narration service." }));
    } finally {
      setNarrating(null);
    }
  }

  return (
    <main className="min-h-screen px-6 py-10 md:px-12 md:py-16 max-w-5xl mx-auto">
      {/* Header */}
      <header className="mb-10 border-b border-rule pb-8">
        <div className="font-mono text-xs tracking-[0.2em] text-amber mb-3">
          PLAYTEST BATCH LOG — HARVEST VALLEY
        </div>
        <h1 className="font-display text-4xl md:text-5xl font-bold text-parchment mb-3">
          Autonomous Playtest Lab
        </h1>
        <p className="text-muted max-w-2xl leading-relaxed">
          Heuristic AI personas play the game hundreds of times. Statistics flag what looks
          broken. An LLM reads the actual game log and explains why — citing specific turns,
          not vibes.
        </p>
      </header>

      {/* Config */}
      <section className="mb-10 flex flex-wrap items-end gap-6 bg-surface border border-rule rounded-md p-5">
        <div>
          <label className="block font-mono text-xs text-muted mb-1.5">PLAYERS</label>
          <select
            value={numPlayers}
            onChange={(e) => setNumPlayers(Number(e.target.value))}
            className="focus-ring bg-surfaceRaised border border-rule rounded px-3 py-1.5 text-parchment font-mono text-sm"
          >
            {[2, 3, 4].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block font-mono text-xs text-muted mb-1.5">GAMES PER LINEUP</label>
          <input
            type="number"
            min={5}
            max={100}
            value={gamesPerLineup}
            onChange={(e) => setGamesPerLineup(Number(e.target.value))}
            className="focus-ring bg-surfaceRaised border border-rule rounded px-3 py-1.5 text-parchment font-mono text-sm w-28"
          />
        </div>
        <button
          onClick={runSimulation}
          disabled={loading}
          className="focus-ring ml-auto bg-amber text-ink font-display font-bold px-6 py-2 rounded hover:brightness-110 transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? "Simulating…" : "Run batch"}
        </button>
      </section>

      {error && (
        <div className="mb-8 border border-brick text-brick font-mono text-sm rounded p-4">
          {error}
        </div>
      )}

      {data && (
        <>
          <p className="font-mono text-xs text-muted mb-6">
            {data.report.numGames} games simulated · {numPlayers} players · {gamesPerLineup} per lineup
          </p>

          {/* Stat panels */}
          <section className="grid md:grid-cols-3 gap-5 mb-10">
            <div className="bg-surface border border-rule rounded-md p-5">
              <h2 className="font-display font-medium text-parchment mb-3 text-sm">
                Win rate by persona
              </h2>
              {Object.entries(data.report.personaWinRate).map(([k, v]) => (
                <BarRow key={k} label={k} value={v} />
              ))}
            </div>
            <div className="bg-surface border border-rule rounded-md p-5">
              <h2 className="font-display font-medium text-parchment mb-3 text-sm">
                Win rate by seat
              </h2>
              {Object.entries(data.report.seatWinRate).map(([k, v]) => (
                <BarRow key={k} label={`Seat ${k}`} value={v} />
              ))}
            </div>
            <div className="bg-surface border border-rule rounded-md p-5">
              <h2 className="font-display font-medium text-parchment mb-3 text-sm">
                Action usage share
              </h2>
              {Object.entries(data.report.actionUsageShare).map(([k, v]) => (
                <BarRow key={k} label={k} value={v} />
              ))}
            </div>
          </section>

          {/* Flagged issues */}
          <section>
            <h2 className="font-display text-xl font-bold text-parchment mb-4">
              Flagged issues ({data.report.issues.length})
            </h2>

            {data.report.issues.length === 0 && (
              <p className="text-muted font-mono text-sm">
                No issues flagged at this sample size — try raising games per lineup.
              </p>
            )}

            <div className="space-y-3">
              {data.report.issues.map((issue, i) => {
                const key = `${issue.type}-${i}`;
                const style = ISSUE_STYLE[issue.type] ?? {
                  border: "border-rule",
                  label: issue.type,
                  tint: "text-parchment",
                };
                const isOpen = openIssueKey === key;
                return (
                  <div key={key} className={`border-l-4 ${style.border} bg-surface rounded-r-md`}>
                    <div className="flex items-center justify-between gap-4 p-4">
                      <div>
                        <div className={`font-mono text-[10px] tracking-widest mb-1 ${style.tint}`}>
                          {style.label}
                        </div>
                        <p className="text-parchment text-sm">{issue.detail}</p>
                      </div>
                      <button
                        onClick={() => explainIssue(issue, key)}
                        className="focus-ring shrink-0 font-mono text-xs text-ink bg-parchment px-3 py-1.5 rounded hover:brightness-95 transition"
                      >
                        {narrating === key ? "Explaining…" : isOpen ? "Hide" : "Explain this"}
                      </button>
                    </div>

                    {isOpen && (
                      <div className="border-t border-rule bg-ink/60 px-4 py-4 rounded-br-md">
                        {narrating === key ? (
                          <p className="font-mono text-xs text-muted caret">Reading the game log</p>
                        ) : (
                          <pre className="font-mono text-xs text-parchment/90 whitespace-pre-wrap leading-relaxed">
                            {narratives[key]}
                          </pre>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        </>
      )}
    </main>
  );
}

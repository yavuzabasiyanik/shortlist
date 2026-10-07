import type { ResumeOutcome } from "@/lib/ranking/schema";

// POST /api/rank streams newline-delimited JSON, one event per line:
//   start → result (one per resume, in finishing order) → stopped? → done
export type RankEvent =
  | { type: "start"; total: number; runsLeftToday: number; resetsAt: number }
  | { type: "result"; outcome: ResumeOutcome }
  | { type: "stopped"; reason: "provider_rejected" }
  | { type: "done"; scored: number; failed: number };

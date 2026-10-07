"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { RankEvent } from "@/lib/ranking/events";
import type { ResumeOutcome } from "@/lib/ranking/schema";

export type RunStatus = "idle" | "running" | "done" | "cancelled" | "interrupted" | "failed";

export type RunState = {
  status: RunStatus;
  // The resumes sent, in upload order; results are matched by id.
  submitted: { id: string; fileName: string }[];
  outcomes: ResumeOutcome[];
  providerStopped: boolean;
  runsLeftToday: number | null;
  error: string | null;
};

const initial: RunState = {
  status: "idle",
  submitted: [],
  outcomes: [],
  providerStopped: false,
  runsLeftToday: null,
  error: null,
};

type Resume = { id: string; fileName: string; text: string };

// Sends one ranking run and reads the NDJSON stream as results arrive.
// Extracted text goes only to /api/rank; nothing is stored or logged here.
export function useLiveRanking() {
  const [state, setState] = useState<RunState>(initial);
  const controller = useRef<AbortController | null>(null);

  useEffect(() => () => controller.current?.abort(), []);

  const start = useCallback(async (jobDescription: string, resumes: Resume[]) => {
    if (controller.current) return; // a run is already in progress
    const abort = new AbortController();
    controller.current = abort;
    setState({ ...initial, status: "running", submitted: resumes.map(({ id, fileName }) => ({ id, fileName })) });

    const fail = (status: RunStatus, error: string | null) => setState((s) => ({ ...s, status, error }));

    try {
      const response = await fetch("/api/rank", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jobDescription, resumes }),
        signal: abort.signal,
      });

      if (!response.ok || !response.body) {
        const body = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
        fail("failed", body?.error?.message ?? `The ranking request failed (HTTP ${response.status}).`);
        return;
      }

      const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
      let buffer = "";
      let finished = false;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += value;
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const event = JSON.parse(line) as RankEvent;
          if (event.type === "start") setState((s) => ({ ...s, runsLeftToday: event.runsLeftToday }));
          if (event.type === "result") setState((s) => ({ ...s, outcomes: [...s.outcomes, event.outcome] }));
          if (event.type === "stopped") setState((s) => ({ ...s, providerStopped: true }));
          if (event.type === "done") finished = true;
        }
      }
      if (finished) setState((s) => ({ ...s, status: "done" }));
      else fail("interrupted", "The connection closed before every resume was scored.");
    } catch {
      if (abort.signal.aborted) fail("cancelled", null);
      else fail("interrupted", "The connection was interrupted before every resume was scored.");
    } finally {
      controller.current = null;
    }
  }, []);

  const cancel = useCallback(() => controller.current?.abort(), []);

  return { state, start, cancel };
}

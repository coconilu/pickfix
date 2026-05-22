"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchAgentStatus, type AgentStatus } from "@/lib/agent";

type ClaudeStatusState = "checking" | "available" | "unavailable" | "error";

function getState(status: AgentStatus | null, error: string | null, checking: boolean): ClaudeStatusState {
  if (checking && !status) return "checking";
  if (error) return "error";
  if (!status) return "checking";
  return status.available ? "available" : "unavailable";
}

function getLabel(state: ClaudeStatusState): string {
  if (state === "available") return "Claude ready";
  if (state === "unavailable") return "Claude missing";
  if (state === "error") return "Check failed";
  return "Checking…";
}

function getTitle(state: ClaudeStatusState, status: AgentStatus | null, error: string | null): string {
  if (state === "available") {
    const version = status?.version ? ` ${status.version}` : "";
    return `Claude Code${version} detected via ${status?.bin ?? "claude"}. Agent is ready.`;
  }

  if (state === "unavailable") {
    return `${status?.error ?? "Claude Code is not available."} Install Claude Code or set CLAUDE_BIN.`;
  }

  if (state === "error") {
    return error ?? "Could not verify Claude Code status. Agent may still work.";
  }

  return "Checking if Claude Code is available…";
}

export function ClaudeStatus() {
  const [status, setStatus] = useState<AgentStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);

  const checkStatus = useCallback(async () => {
    setChecking(true);
    setError(null);
    try {
      setStatus(await fetchAgentStatus());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStatus(null);
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  const state = getState(status, error, checking);
  const title = useMemo(() => getTitle(state, status, error), [error, state, status]);

  return (
    <button
      type="button"
      className={`claude-status claude-status-${state}`}
      onClick={checkStatus}
      title={`${title} Click to re-check.`}
      aria-label={title}
    >
      <span className={`claude-status-dot claude-status-dot-${state}`} />
      <span>{getLabel(state)}</span>
    </button>
  );
}

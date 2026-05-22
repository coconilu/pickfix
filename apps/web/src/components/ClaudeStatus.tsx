"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchAgentStatus, type AgentStatus } from "@/lib/agent";
import { useSessionActions, useSessionState, type ClaudeModel } from "@/providers/session";

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

const MODEL_OPTIONS: { value: ClaudeModel; label: string }[] = [
  { value: "default", label: "Default" },
  { value: "sonnet", label: "Sonnet" },
  { value: "opus", label: "Opus" },
  { value: "haiku", label: "Haiku" },
];

function getModelLabel(model: ClaudeModel, status: AgentStatus | null): string {
  if (model !== "default") return model;
  return status?.model?.trim() || "default";
}

function getTitle(state: ClaudeStatusState, status: AgentStatus | null, error: string | null, model: ClaudeModel): string {
  if (state === "available") {
    const version = status?.version ? ` ${status.version}` : "";
    return `Claude Code${version} detected via ${status?.bin ?? "claude"}. Model: ${getModelLabel(model, status)}. Agent is ready.`;
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
  const { claudeModel } = useSessionState();
  const { setClaudeModel } = useSessionActions();
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
  const title = useMemo(() => getTitle(state, status, error, claudeModel), [claudeModel, error, state, status]);

  return (
    <div className="claude-status-group">
      <button
        type="button"
        className={`claude-status claude-status-${state}`}
        onClick={checkStatus}
        title={`${title} Click to re-check.`}
        aria-label={title}
      >
        <span className={`claude-status-dot claude-status-dot-${state}`} />
        <span>{getLabel(state)}</span>
        {state === "available" && (
          <span className="claude-status-model">{getModelLabel(claudeModel, status)}</span>
        )}
      </button>
      <select
        className="claude-model-select"
        value={claudeModel}
        onChange={(event) => setClaudeModel(event.target.value as ClaudeModel)}
        aria-label="Claude model"
        title="Choose the Claude model for new agent requests"
      >
        {MODEL_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </div>
  );
}

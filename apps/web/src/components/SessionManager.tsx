"use client";

import { useMemo } from "react";
import { useSessionActions, useSessionState } from "@/providers/session";

export function SessionManager() {
  const { sessionId, projectName, availableSessions, isStreaming } = useSessionState();
  const { createSession, switchSession, deleteSession } = useSessionActions();

  const currentSession = useMemo(
    () => availableSessions.find((session) => session.id === sessionId),
    [availableSessions, sessionId],
  );

  const canDelete = availableSessions.length > 1 && !isStreaming;

  return (
    <div className="session-manager" aria-label="Project sessions">
      <span className="session-project" title={projectName}>{projectName}</span>
      <select
        className="session-select"
        value={sessionId}
        aria-label="Select session"
        disabled={isStreaming || availableSessions.length === 0}
        onChange={(event) => switchSession(event.target.value)}
      >
        {(availableSessions.length > 0 ? availableSessions : [{ id: sessionId, title: currentSession?.title ?? "Session 1" }]).map((session) => (
          <option key={session.id} value={session.id}>{session.title}</option>
        ))}
      </select>
      <button
        type="button"
        className="session-action"
        onClick={createSession}
        disabled={isStreaming}
        title="New session"
      >
        New
      </button>
      <button
        type="button"
        className="session-action session-action-danger"
        onClick={() => deleteSession(sessionId)}
        disabled={!canDelete}
        title="Delete current session"
      >
        Delete
      </button>
    </div>
  );
}

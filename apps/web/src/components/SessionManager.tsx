"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSessionActions, useSessionState } from "@/providers/session";

export function SessionManager() {
  const { sessionId, projectName, availableSessions, isStreaming } = useSessionState();
  const { createSession, switchSession, deleteSession } = useSessionActions();

  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const currentSession = useMemo(
    () => availableSessions.find((session) => session.id === sessionId),
    [availableSessions, sessionId],
  );

  const canDelete = availableSessions.length > 1 && !isStreaming;
  const disabled = isStreaming;

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open]);

  const handleTrigger = useCallback(() => {
    if (!disabled) setOpen((prev) => !prev);
  }, [disabled]);

  const handleSwitch = useCallback(
    (id: string) => {
      switchSession(id);
      setOpen(false);
    },
    [switchSession],
  );

  const handleDelete = useCallback(
    (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      e.preventDefault();
      if (!canDelete) return;
      deleteSession(id);
      // If the last session was just deleted, close the dropdown
      if (availableSessions.length <= 2) setOpen(false);
    },
    [canDelete, deleteSession, availableSessions.length],
  );

  const handleCreate = useCallback(() => {
    createSession();
    setOpen(false);
  }, [createSession]);

  return (
    <div className="session-manager" ref={containerRef} aria-label="Project sessions">
      <span className="session-project" title={projectName}>{projectName}</span>

      <div className="session-controls">
        <button
          type="button"
          className="session-add-icon-btn"
          onClick={handleCreate}
          disabled={disabled}
          title="Add new session"
          aria-label="Add new session"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
            <path d="M6 1V11M1 6H11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </button>

        <button
          type="button"
          className="session-dropdown-trigger"
          onClick={handleTrigger}
          disabled={disabled}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-label={`Current session: ${currentSession?.title ?? "Session 1"}. Click to switch.`}
          title={currentSession?.title ?? "Session 1"}
        >
          <span className="session-dropdown-trigger-label">
            {currentSession?.title ?? "Session 1"}
          </span>
          <svg
            className={`session-dropdown-chevron ${open ? "session-dropdown-chevron-open" : ""}`}
            width="10"
            height="6"
            viewBox="0 0 10 6"
            fill="none"
            aria-hidden="true"
          >
            <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      {open && (
        <div className="session-dropdown-panel">
          <ul className="session-dropdown-list" ref={listRef} role="listbox" aria-label="Sessions">
            {availableSessions.map((session) => {
              const isCurrent = session.id === sessionId;
              return (
                <li
                  key={session.id}
                  role="option"
                  aria-selected={isCurrent}
                  className={`session-dropdown-row ${isCurrent ? "session-dropdown-row-current" : ""}`}
                  onClick={() => handleSwitch(session.id)}
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      handleSwitch(session.id);
                    }
                  }}
                >
                  <span className="session-dropdown-row-title">{session.title}</span>
                  <button
                    type="button"
                    className="session-dropdown-row-delete"
                    onClick={(e) => handleDelete(e, session.id)}
                    disabled={!canDelete}
                    aria-label={`Delete ${session.title}`}
                    title={`Delete ${session.title}`}
                    tabIndex={0}
                  >
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                      <path d="M3 3L9 9M9 3L3 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

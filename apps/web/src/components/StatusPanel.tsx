"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { getGitStatus, revertGitFile, type GitFileChange, type GitStatus } from "@/lib/git";

function statusLabel(status: GitFileChange["status"]): string {
  if (status === "added") return "A";
  if (status === "deleted") return "D";
  return "M";
}

function diffLineClass(line: string): string {
  if (line.startsWith("+++") || line.startsWith("---")) return "diff-line diff-meta";
  if (line.startsWith("+")) return "diff-line diff-add";
  if (line.startsWith("-")) return "diff-line diff-del";
  if (line.startsWith("@@")) return "diff-line diff-meta";
  return "diff-line";
}

export function StatusPanel() {
  const [status, setStatus] = useState<GitStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [revertingFile, setRevertingFile] = useState<string | null>(null);
  const [pendingRevert, setPendingRevert] = useState<GitFileChange | null>(null);

  const fileChanges = useMemo(
    () => status?.fileChanges.filter((change) => change.path.trim().length > 0) ?? [],
    [status],
  );

  const refreshStatus = useCallback(async () => {
    try {
      setStatus(await getGitStatus());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  useEffect(() => {
    const onRefresh = () => refreshStatus();
    window.addEventListener("pickfix:changes-refresh", onRefresh);
    return () => window.removeEventListener("pickfix:changes-refresh", onRefresh);
  }, [refreshStatus]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") refreshStatus();
    }, 3000);
    return () => window.clearInterval(interval);
  }, [refreshStatus]);

  useEffect(() => {
    if (!status) return;
    if (selectedFile && fileChanges.some((change) => change.path === selectedFile)) return;
    setSelectedFile(fileChanges[0]?.path ?? null);
  }, [fileChanges, selectedFile, status]);

  const selectedChange = useMemo(
    () => fileChanges.find((change) => change.path === selectedFile) ?? null,
    [fileChanges, selectedFile],
  );

  const cancelRevert = useCallback(() => {
    setPendingRevert(null);
  }, []);

  const confirmRevert = useCallback(async () => {
    if (!pendingRevert) return;
    const change = pendingRevert;
    setPendingRevert(null);
    setError(null);
    setRevertingFile(change.path);
    try {
      const nextStatus = await revertGitFile(change.path);
      setStatus(nextStatus);
      if (selectedFile === change.path) {
        setSelectedFile(nextStatus.fileChanges[0]?.path ?? null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setRevertingFile(null);
    }
  }, [pendingRevert, selectedFile]);

  // Close dialog on Escape key
  useEffect(() => {
    if (!pendingRevert) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") cancelRevert();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pendingRevert, cancelRevert]);

  function handleRevertClick(change: GitFileChange) {
    setPendingRevert(change);
  }

  if (!status) {
    return (
      <div className="status-panel">
        <div className="status-panel-header">
          <h2 className="status-panel-title">Changes</h2>
        </div>
        <div className="status-loading">{error ?? "Checking for changes…"}</div>
      </div>
    );
  }

  return (
    <div className="status-panel">
      <div className="status-panel-header status-panel-header-row">
        <h2 className="status-panel-title">Changes</h2>
        <span className="status-count-badge">{fileChanges.length}</span>
      </div>

      {status.branch && (
        <div className="status-repo-strip">
          <span className="status-branch-chip">
            ⎇ {status.branch}{status.baseBranch ? ` · based on ${status.baseBranch}` : ""}
          </span>
        </div>
      )}

      {status.message && (
        <div className="status-note">
          {status.repositoryStatus === "parent"
            ? "This folder is not a git repository. Showing only changes inside this project folder."
            : status.message}
        </div>
      )}

      <div className="status-section status-changes-section">
        {fileChanges.length > 0 ? (
          <div className="status-file-browser">
            <ul className="status-file-list" aria-label="Changed files">
              {fileChanges.map((change) => {
                const isSelected = change.path === selectedChange?.path;
                return (
                  <li key={change.path} className={`status-file-row ${isSelected ? "active" : ""}`}>
                    <button type="button" className="status-file-select" onClick={() => setSelectedFile(change.path)}>
                      <span className={`status-file-badge badge-${change.status}`}>{statusLabel(change.status)}</span>
                      <span className="status-file-name">{change.path}</span>
                    </button>
                    <button
                      type="button"
                      className="status-file-revert"
                      onClick={() => handleRevertClick(change)}
                      disabled={revertingFile === change.path}
                      title={`Revert ${change.path}`}
                      aria-label={`Revert ${change.path}`}
                    >
                      {revertingFile === change.path ? "…" : "↺"}
                    </button>
                  </li>
                );
              })}
            </ul>
            {error && <div className="status-error">{error}</div>}

            <div className="status-file-preview">
              {selectedChange ? (
                <>
                  <div className="status-file-preview-title">{selectedChange.path}</div>
                  <pre className="status-file-diff">
                    {selectedChange.diff.split("\n").map((line, index) => (
                      <span key={`${index}-${line}`} className={diffLineClass(line)}>
                        {line || " "}
                      </span>
                    ))}
                  </pre>
                </>
              ) : (
                <div className="status-empty">Select a file to preview its changes.</div>
              )}
            </div>
          </div>
        ) : (
          <div className="status-empty">No changes yet — start editing to see file changes here.</div>
        )}
      </div>

      <div className="status-actions">
        <button className="status-btn" disabled title="Coming in Phase 2">
          Commit Changes
        </button>
      </div>

      {pendingRevert && (
        <div className="confirm-overlay" onClick={cancelRevert}>
          <div className="confirm-dialog" onClick={(e) => e.stopPropagation()} role="alertdialog" aria-modal="true">
            <div className="confirm-dialog-icon">⚠</div>
            <div className="confirm-dialog-title">Revert changes?</div>
            <div className="confirm-dialog-body">
              This will discard all local changes to this file. This action cannot be undone.
            </div>
            <div className="confirm-dialog-path">{pendingRevert.path}</div>
            <div className="confirm-dialog-actions">
              <button type="button" className="confirm-btn confirm-btn-cancel" onClick={cancelRevert}>
                Cancel
              </button>
              <button
                type="button"
                className="confirm-btn confirm-btn-destructive"
                onClick={confirmRevert}
                disabled={revertingFile !== null}
              >
                Revert
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

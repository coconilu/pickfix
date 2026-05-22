"use client";

import { useEffect, useMemo, useState } from "react";
import { getGitStatus, type GitFileChange, type GitStatus } from "@/lib/git";

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

  useEffect(() => {
    getGitStatus().then(setStatus).catch((err) => {
      setError(err instanceof Error ? err.message : String(err));
    });
  }, []);

  useEffect(() => {
    if (!status) return;
    if (selectedFile && status.fileChanges.some((change) => change.path === selectedFile)) return;
    setSelectedFile(status.fileChanges[0]?.path ?? null);
  }, [selectedFile, status]);

  const selectedChange = useMemo(
    () => status?.fileChanges.find((change) => change.path === selectedFile) ?? null,
    [selectedFile, status],
  );

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
        <span className="status-count-badge">{status.fileChanges.length}</span>
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
        {status.fileChanges.length > 0 ? (
          <div className="status-file-browser">
            <ul className="status-file-list" aria-label="Changed files">
              {status.fileChanges.map((change) => {
                const isSelected = change.path === selectedChange?.path;
                return (
                  <li key={change.path}>
                    <button
                      type="button"
                      className={`status-file-row ${isSelected ? "active" : ""}`}
                      onClick={() => setSelectedFile(change.path)}
                    >
                      <span className={`status-file-badge badge-${change.status}`}>
                        {statusLabel(change.status)}
                      </span>
                      <span className="status-file-name">{change.path}</span>
                    </button>
                  </li>
                );
              })}
            </ul>

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
    </div>
  );
}

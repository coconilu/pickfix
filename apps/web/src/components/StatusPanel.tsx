"use client";

import { useEffect, useState } from "react";
import { getGitStatus, getDiffSummary, type GitStatus } from "@/lib/git";

export function StatusPanel() {
  const [status, setStatus] = useState<GitStatus | null>(null);
  const [diff, setDiff] = useState<string>("");

  useEffect(() => {
    getGitStatus().then(setStatus);
    getDiffSummary().then(setDiff);
  }, []);

  if (!status) {
    return (
      <div className="status-panel">
        <div className="status-panel-header">
          <h2 className="status-panel-title">Branch Status</h2>
        </div>
        <div className="status-loading">Loading...</div>
      </div>
    );
  }

  return (
    <div className="status-panel">
      <div className="status-panel-header">
        <h2 className="status-panel-title">Branch Status</h2>
      </div>

      {/* Branch info */}
      <div className="status-section">
        <div className="status-section-title">Branch</div>
        <div className="status-branch-info">
          <div className="status-branch-current">
            <span className="status-branch-icon">⎇</span>
            <span>{status.branch}</span>
          </div>
          <div className="status-branch-base">
            ← based on <strong>{status.baseBranch}</strong>
          </div>
        </div>
      </div>

      {/* Changed files */}
      <div className="status-section">
        <div className="status-section-title">
          Changed Files ({status.changedFiles.length})
        </div>
        <ul className="status-file-list">
          {status.changedFiles.map((file) => (
            <li key={file} className={`status-file status-file-modified`}>
              <span className="status-file-icon">
                {status.modified.includes(file) ? "M" : status.added.includes(file) ? "A" : "D"}
              </span>
              <span className="status-file-name">{file}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Diff preview */}
      <div className="status-section">
        <div className="status-section-title">Recent Diff</div>
        <pre className="status-diff">{diff}</pre>
      </div>

      {/* Actions */}
      <div className="status-actions">
        <button className="status-btn" disabled title="Coming in Phase 2">
          Commit Changes
        </button>
        <button className="status-btn status-btn-secondary" disabled title="Coming in Phase 2">
          Create PR
        </button>
      </div>
    </div>
  );
}

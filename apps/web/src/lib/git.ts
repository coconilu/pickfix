/**
 * Git operations for the Status panel.
 * MVP: returns mock data. Phase 2 will use real git through child_process.
 */

export interface GitStatus {
  branch: string;
  baseBranch: string;
  changedFiles: string[];
  added: string[];
  modified: string[];
  deleted: string[];
}

/**
 * Get the current git status of the project.
 * MVP: returns mock data showing what a real session would look like.
 */
export async function getGitStatus(): Promise<GitStatus> {
  // MVP: mock data
  try {
    return {
      branch: "pickfix/demo-change-1",
      baseBranch: "main",
      changedFiles: [
        "src/app/page.tsx",
        "src/app/globals.css",
        "src/app/layout.tsx",
      ],
      added: [],
      modified: [
        "src/app/page.tsx",
        "src/app/globals.css",
      ],
      deleted: [],
    };
  } catch {
    return {
      branch: "unknown",
      baseBranch: "main",
      changedFiles: [],
      added: [],
      modified: [],
      deleted: [],
    };
  }
}

/**
 * Get a diff summary for display.
 */
export async function getDiffSummary(): Promise<string> {
  return `--- a/src/app/page.tsx
+++ b/src/app/page.tsx
@@ -12,7 +12,7 @@
       <h1 className="text-5xl font-bold">
-        Build Faster
+        Build Smarter
       </h1>
-      <button className="rounded-xl bg-blue-600">
+      <button className="rounded-md bg-green-600">
         Start Free Trial
       </button>`;
}

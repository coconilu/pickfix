export interface GitFileChange {
  path: string;
  status: "added" | "modified" | "deleted";
  diff: string;
}

export interface GitStatus {
  repositoryStatus: "own" | "parent" | "none";
  isGitRepo: boolean;
  branch: string | null;
  baseBranch: string | null;
  changedFiles: string[];
  added: string[];
  modified: string[];
  deleted: string[];
  fileChanges: GitFileChange[];
  diff: string;
  message?: string;
}

export async function getGitStatus(): Promise<GitStatus> {
  const res = await fetch("/api/git", { cache: "no-store" });
  if (!res.ok) {
    throw new Error(await res.text());
  }
  return res.json();
}

export async function getDiffSummary(): Promise<string> {
  return (await getGitStatus()).diff;
}

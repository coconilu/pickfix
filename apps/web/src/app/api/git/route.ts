import { execFile } from "node:child_process";
import { realpath } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import type { GitFileChange, GitStatus } from "@/lib/git";

export const runtime = "nodejs";

const execFileAsync = promisify(execFile);
const MAX_DIFF_CHARS = 80_000;

interface ParsedChange {
  path: string;
  repoPath: string;
  status: GitFileChange["status"];
}

async function git(args: string[], cwd: string): Promise<string> {
  const { stdout } = await execFileAsync("git", args, {
    cwd,
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 10,
  });
  return stdout.trimEnd();
}

function stripProjectPath(filePath: string, projectPath: string): string {
  if (projectPath === ".") return filePath;
  return filePath.startsWith(`${projectPath}/`) ? filePath.slice(projectPath.length + 1) : filePath;
}

function parsePorcelain(output: string, projectPath: string): Pick<GitStatus, "changedFiles" | "added" | "modified" | "deleted"> & { changes: ParsedChange[] } {
  const changedFiles: string[] = [];
  const added: string[] = [];
  const modified: string[] = [];
  const deleted: string[] = [];
  const changes: ParsedChange[] = [];

  for (const line of output.split("\n")) {
    if (!line) continue;

    const indexStatus = line[0];
    const worktreeStatus = line[1];
    const rawPath = line.slice(3);
    const repoPath = rawPath.includes(" -> ") ? rawPath.split(" -> ").pop()! : rawPath;
    const filePath = stripProjectPath(repoPath, projectPath);
    if (!repoPath.trim() || !filePath.trim()) continue;
    changedFiles.push(filePath);

    if (line.startsWith("??") || indexStatus === "A" || worktreeStatus === "A") {
      added.push(filePath);
      changes.push({ path: filePath, repoPath, status: "added" });
    } else if (indexStatus === "D" || worktreeStatus === "D") {
      deleted.push(filePath);
      changes.push({ path: filePath, repoPath, status: "deleted" });
    } else {
      modified.push(filePath);
      changes.push({ path: filePath, repoPath, status: "modified" });
    }
  }

  return { changedFiles, added, modified, deleted, changes };
}

async function getBranch(gitRoot: string): Promise<string> {
  const branch = await git(["branch", "--show-current"], gitRoot);
  if (branch) return branch;
  return git(["rev-parse", "--short", "HEAD"], gitRoot);
}

async function getBaseBranch(gitRoot: string): Promise<string | null> {
  try {
    const upstream = await git(["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{upstream}"], gitRoot);
    if (upstream) return upstream;
  } catch {
    // No upstream configured.
  }

  try {
    const originHead = await git(["symbolic-ref", "--short", "refs/remotes/origin/HEAD"], gitRoot);
    return originHead.replace(/^origin\//, "");
  } catch {
    return null;
  }
}

function truncateDiff(diff: string): string {
  if (diff.length <= MAX_DIFF_CHARS) return diff;
  return `${diff.slice(0, MAX_DIFF_CHARS)}\n\n… diff truncated after ${MAX_DIFF_CHARS.toLocaleString()} characters.`;
}

async function getFileDiff(change: ParsedChange, gitRoot: string, projectPath: string): Promise<GitFileChange> {
  if (change.status === "added") {
    try {
      await git(["ls-files", "--error-unmatch", "--", change.repoPath], gitRoot);
    } catch {
      return {
        path: change.path,
        status: change.status,
        diff: "This is a new untracked file. Add it to git to see a line-by-line diff.",
      };
    }
  }

  const relativeArg = projectPath === "." ? "--relative" : `--relative=${projectPath}`;
  const [stagedDiff, unstagedDiff] = await Promise.all([
    git(["diff", "--cached", relativeArg, "--no-ext-diff", "--", change.repoPath], gitRoot),
    git(["diff", relativeArg, "--no-ext-diff", "--", change.repoPath], gitRoot),
  ]);

  return {
    path: change.path,
    status: change.status,
    diff: truncateDiff([stagedDiff, unstagedDiff].filter(Boolean).join("\n\n")) || "No line-by-line diff available for this file.",
  };
}

function emptyStatus(repositoryStatus: GitStatus["repositoryStatus"], message: string, diff: string): GitStatus {
  return {
    repositoryStatus,
    isGitRepo: false,
    branch: null,
    baseBranch: null,
    changedFiles: [],
    added: [],
    modified: [],
    deleted: [],
    fileChanges: [],
    diff,
    message,
  };
}

export async function GET(): Promise<Response> {
  const configuredProjectRoot = process.env.PICKFIX_PROJECT_ROOT || process.env.PF_AGENT_CWD || process.cwd();
  const projectRoot = await realpath(configuredProjectRoot).catch(() => configuredProjectRoot);

  try {
    await git(["rev-parse", "--is-inside-work-tree"], projectRoot);
  } catch {
    return Response.json(emptyStatus(
      "none",
      "This project is not inside a git repository.",
      "Git is not initialized for this project, so PickFix cannot show a line-by-line diff yet.",
    ));
  }

  try {
    const gitRoot = await git(["rev-parse", "--show-toplevel"], projectRoot);
    const projectPath = path.relative(gitRoot, projectRoot) || ".";
    const pathspec = projectPath.startsWith("..") ? "." : projectPath;
    const isOwnRepo = pathspec === ".";
    const [branch, baseBranch, porcelain] = await Promise.all([
      isOwnRepo ? getBranch(gitRoot) : Promise.resolve(null),
      isOwnRepo ? getBaseBranch(gitRoot) : Promise.resolve(null),
      git(["status", "--porcelain=v1", "--", pathspec], gitRoot),
    ]);
    const parsed = parsePorcelain(porcelain, pathspec);
    const fileChanges = await Promise.all(parsed.changes.map((change) => getFileDiff(change, gitRoot, pathspec)));
    const diff = truncateDiff(fileChanges.map((change) => change.diff).filter(Boolean).join("\n\n"));

    const status: GitStatus = {
      repositoryStatus: isOwnRepo ? "own" : "parent",
      isGitRepo: isOwnRepo,
      branch,
      baseBranch,
      changedFiles: parsed.changedFiles,
      added: parsed.added,
      modified: parsed.modified,
      deleted: parsed.deleted,
      fileChanges,
      diff: diff || "No changes yet — start editing to see a diff here.",
      message: isOwnRepo ? undefined : "This folder is not a git repository. Showing changed files from the parent repository.",
    };
    return Response.json(status);
  } catch {
    return Response.json(emptyStatus(
      "none",
      "Unable to read git status for this project.",
      "Unable to read file changes.",
    ));
  }
}

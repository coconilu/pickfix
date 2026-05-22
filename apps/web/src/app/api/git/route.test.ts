import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { afterEach, describe, expect, it } from "vitest";
import { DELETE, GET } from "./route";

const execFileAsync = promisify(execFile);
const tempRoots: string[] = [];
const originalProjectRoot = process.env.PICKFIX_PROJECT_ROOT;
const originalAgentCwd = process.env.PF_AGENT_CWD;

async function git(cwd: string, args: string[]): Promise<string> {
  const { stdout } = await execFileAsync("git", args, { cwd, encoding: "utf8" });
  return stdout.trimEnd();
}

async function createRepo(): Promise<string> {
  const repo = await mkdtemp(path.join(tmpdir(), "pickfix-web-git-"));
  tempRoots.push(repo);
  await git(repo, ["init"]);
  await git(repo, ["config", "user.email", "pickfix@example.test"]);
  await git(repo, ["config", "user.name", "PickFix Test"]);
  await writeFile(path.join(repo, "tracked.txt"), "original\n", "utf8");
  await git(repo, ["add", "."]);
  await git(repo, ["commit", "-m", "initial"]);
  return repo;
}

function setProjectRoot(projectRoot: string) {
  process.env.PICKFIX_PROJECT_ROOT = projectRoot;
  delete process.env.PF_AGENT_CWD;
}

function deleteRequest(body: unknown): Request {
  return new Request("http://pickfix.test/api/git", {
    method: "DELETE",
    body: typeof body === "string" ? body : JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

async function exists(filePath: string): Promise<boolean> {
  return stat(filePath).then(() => true, () => false);
}

afterEach(async () => {
  if (originalProjectRoot === undefined) delete process.env.PICKFIX_PROJECT_ROOT;
  else process.env.PICKFIX_PROJECT_ROOT = originalProjectRoot;

  if (originalAgentCwd === undefined) delete process.env.PF_AGENT_CWD;
  else process.env.PF_AGENT_CWD = originalAgentCwd;

  await Promise.all(tempRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("git API DELETE", () => {
  it("rejects invalid JSON and unsafe paths", async () => {
    const invalidJson = await DELETE(deleteRequest("{"));
    expect(invalidJson.status).toBe(400);
    expect(await invalidJson.text()).toContain("Invalid JSON");

    const unsafe = await DELETE(deleteRequest({ path: "../outside.txt" }));
    expect(unsafe.status).toBe(400);
    expect(await unsafe.text()).toContain("safe relative file path");

    const absolute = await DELETE(deleteRequest({ path: path.resolve("outside.txt") }));
    expect(absolute.status).toBe(400);
  });

  it("reverts a modified tracked file", async () => {
    const repo = await createRepo();
    setProjectRoot(repo);
    await writeFile(path.join(repo, "tracked.txt"), "changed\n", "utf8");

    const response = await DELETE(deleteRequest({ path: "tracked.txt" }));

    expect(response.status).toBe(200);
    expect(await readFile(path.join(repo, "tracked.txt"), "utf8")).toBe("original\n");
    expect((await response.json()).changedFiles).not.toContain("tracked.txt");
  });

  it("removes an untracked file", async () => {
    const repo = await createRepo();
    setProjectRoot(repo);
    const filePath = path.join(repo, "untracked.txt");
    await writeFile(filePath, "new\n", "utf8");

    const response = await DELETE(deleteRequest({ path: "untracked.txt" }));

    expect(response.status).toBe(200);
    expect(await exists(filePath)).toBe(false);
    expect((await response.json()).changedFiles).not.toContain("untracked.txt");
  });

  it("unstages and removes a staged new file", async () => {
    const repo = await createRepo();
    setProjectRoot(repo);
    const filePath = path.join(repo, "staged-new.txt");
    await writeFile(filePath, "new\n", "utf8");
    await git(repo, ["add", "staged-new.txt"]);

    const response = await DELETE(deleteRequest({ path: "staged-new.txt" }));

    expect(response.status).toBe(200);
    expect(await exists(filePath)).toBe(false);
    await expect(git(repo, ["ls-files", "--error-unmatch", "staged-new.txt"])).rejects.toThrow();
  });

  it("restores a deleted tracked file", async () => {
    const repo = await createRepo();
    setProjectRoot(repo);
    const filePath = path.join(repo, "tracked.txt");
    await rm(filePath);

    const response = await DELETE(deleteRequest({ path: "tracked.txt" }));

    expect(response.status).toBe(200);
    expect(await readFile(filePath, "utf8")).toBe("original\n");
    expect((await response.json()).deleted).not.toContain("tracked.txt");
  });

  it("scopes a subdirectory project root and rejects ../outside", async () => {
    const repo = await createRepo();
    await mkdir(path.join(repo, "project"));
    await writeFile(path.join(repo, "project", "inside.txt"), "inside\n", "utf8");
    await writeFile(path.join(repo, "outside.txt"), "outside\n", "utf8");
    await git(repo, ["add", "."]);
    await git(repo, ["commit", "-m", "add project files"]);
    setProjectRoot(path.join(repo, "project"));

    await writeFile(path.join(repo, "project", "inside.txt"), "inside changed\n", "utf8");
    await writeFile(path.join(repo, "outside.txt"), "outside changed\n", "utf8");

    const status = await GET();
    const json = await status.json();
    expect(json.changedFiles).toEqual(["inside.txt"]);

    const outside = await DELETE(deleteRequest({ path: "../outside.txt" }));
    expect(outside.status).toBe(400);
    expect(await readFile(path.join(repo, "outside.txt"), "utf8")).toBe("outside changed\n");
  });
});

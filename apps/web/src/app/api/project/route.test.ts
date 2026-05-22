import { mkdir, mkdtemp, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { GET } from "./route";

const tempRoots: string[] = [];
const originalProjectRoot = process.env.PICKFIX_PROJECT_ROOT;
const originalAgentCwd = process.env.PF_AGENT_CWD;

afterEach(async () => {
  if (originalProjectRoot === undefined) delete process.env.PICKFIX_PROJECT_ROOT;
  else process.env.PICKFIX_PROJECT_ROOT = originalProjectRoot;

  if (originalAgentCwd === undefined) delete process.env.PF_AGENT_CWD;
  else process.env.PF_AGENT_CWD = originalAgentCwd;

  await Promise.all(tempRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("project API", () => {
  it("returns stable project metadata from PICKFIX_PROJECT_ROOT", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "pickfix-project-"));
    tempRoots.push(root);
    const project = path.join(root, "my-app");
    await mkdir(project);
    process.env.PICKFIX_PROJECT_ROOT = project;
    delete process.env.PF_AGENT_CWD;

    const response = await GET();
    const json = await response.json();

    expect(json.root).toBe(await realpath(project));
    expect(json.name).toBe("my-app");
    expect(json.key).toMatch(/^[a-f0-9]{16}$/);
  });
});

import { execFile } from "node:child_process";
import { promisify } from "node:util";

export const runtime = "nodejs";

const execFileAsync = promisify(execFile);
const STATUS_TIMEOUT_MS = 5000;

interface AgentStatusResponse {
  available: boolean;
  bin: string;
  version?: string;
  model?: string;
  error?: string;
  checkedAt: number;
}

function cleanVersion(output: string): string | undefined {
  const version = output.trim().split(/\r?\n/)[0]?.trim();
  return version || undefined;
}

function unavailable(bin: string, error: string): AgentStatusResponse {
  return {
    available: false,
    bin,
    model: getConfiguredClaudeModel(),
    error,
    checkedAt: Date.now(),
  };
}

function getConfiguredClaudeModel(): string | undefined {
  return (
    process.env.PF_CLAUDE_MODEL ||
    process.env.CLAUDE_MODEL ||
    process.env.ANTHROPIC_MODEL ||
    undefined
  );
}

export async function GET(): Promise<Response> {
  const bin = process.env.CLAUDE_BIN || "claude";

  try {
    const { stdout, stderr } = await execFileAsync(bin, ["--version"], {
      encoding: "utf8",
      timeout: STATUS_TIMEOUT_MS,
      maxBuffer: 1024 * 1024,
    });

    const version = cleanVersion(stdout || stderr);
    const status: AgentStatusResponse = {
      available: true,
      bin,
      version,
      model: getConfiguredClaudeModel(),
      checkedAt: Date.now(),
    };
    return Response.json(status);
  } catch (error) {
    const err = error as NodeJS.ErrnoException & { stderr?: string; killed?: boolean; signal?: string };
    const message =
      err.code === "ENOENT"
        ? `Claude Code executable not found: ${bin}`
        : err.killed || err.signal === "SIGTERM"
          ? `Claude Code status check timed out after ${STATUS_TIMEOUT_MS / 1000}s.`
          : err.stderr?.trim() || err.message || "Claude Code status check failed.";

    return Response.json(unavailable(bin, message));
  }
}

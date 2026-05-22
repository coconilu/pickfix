#!/usr/bin/env node
import { spawn, type ChildProcess } from "node:child_process";
import { readFileSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

interface CliOptions {
  projectRoot: string;
  devCommand?: string;
  port?: number;
  targetUrl: string;
  proxyPort: number;
  webPort: number;
  startDev: boolean;
  framework?: "next" | "nuxt";
}

const workspaceRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const invocationCwd = process.env.INIT_CWD ?? process.cwd();
const children: ChildProcess[] = [];
const WAIT_TIMEOUT_MS = 120_000;
const colors = {
  reset: "\u001b[0m",
  blue: "\u001b[34m",
  green: "\u001b[32m",
  yellow: "\u001b[33m",
  cyan: "\u001b[36m",
};
const labelColors: Record<string, string> = {
  pickfix: colors.blue,
  target: colors.green,
  proxy: colors.yellow,
  web: colors.cyan,
};

function formatLabel(labelName: string): string {
  const color = labelColors[labelName] ?? "";
  return `${color}[${labelName}]${color ? colors.reset : ""}`;
}

function usage(): never {
  console.error(`Usage: pickfix --project <dir> [--dev <command>] --port <port> [--target <url>] [--proxy-port <port>] [--web-port <port>] [--no-dev]`);
  process.exit(1);
}

function parsePort(value: string | undefined, flag: string): number {
  if (!value) usage();
  const port = Number.parseInt(value, 10);
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    console.error(`${formatLabel("pickfix")} Invalid ${flag}: ${value}`);
    process.exit(1);
  }
  return port;
}

function readPackageJson(projectRoot: string): Record<string, unknown> | null {
  try {
    return JSON.parse(readFileSync(resolve(projectRoot, "package.json"), "utf8")) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function detectFramework(pkg: Record<string, unknown> | null): "next" | "nuxt" | undefined {
  const deps = {
    ...(pkg?.dependencies && typeof pkg.dependencies === "object" ? pkg.dependencies : {}),
    ...(pkg?.devDependencies && typeof pkg.devDependencies === "object" ? pkg.devDependencies : {}),
  } as Record<string, unknown>;
  if (typeof deps.next === "string") return "next";
  if (typeof deps.nuxt === "string") return "nuxt";
  return undefined;
}

function hasDevScript(pkg: Record<string, unknown> | null): boolean {
  const scripts = pkg?.scripts;
  return Boolean(scripts && typeof scripts === "object" && typeof (scripts as Record<string, unknown>).dev === "string");
}

function defaultDevCommand(projectRoot: string, port: number | undefined): { command?: string; framework?: "next" | "nuxt" } {
  const pkg = readPackageJson(projectRoot);
  const framework = detectFramework(pkg);
  if (hasDevScript(pkg)) return { command: "pnpm dev", framework };
  if (framework === "next") return { command: `pnpm exec next dev${port ? ` --port ${port}` : ""}`, framework };
  if (framework === "nuxt") return { command: `pnpm exec nuxt dev${port ? ` --port ${port}` : ""}`, framework };
  return { framework };
}

function parseArgs(argv: string[]): CliOptions {
  let project: string | undefined;
  let devCommand: string | undefined;
  let port: number | undefined;
  let target: string | undefined;
  let proxyPort = 4000;
  let webPort = 3001;
  let startDev = true;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--") continue;
    else if (arg === "--project") project = argv[++i];
    else if (arg === "--dev") devCommand = argv[++i];
    else if (arg === "--port") port = parsePort(argv[++i], "--port");
    else if (arg === "--target") target = argv[++i];
    else if (arg === "--proxy-port") proxyPort = parsePort(argv[++i], "--proxy-port");
    else if (arg === "--web-port") webPort = parsePort(argv[++i], "--web-port");
    else if (arg === "--no-dev") startDev = false;
    else usage();
  }

  if (!project) usage();
  if (!target && !port) usage();

  const projectRoot = resolve(invocationCwd, project);
  try {
    if (!statSync(projectRoot).isDirectory()) {
      console.error(`${formatLabel("pickfix")} --project must point to a directory: ${projectRoot}`);
      process.exit(1);
    }
  } catch {
    console.error(`${formatLabel("pickfix")} --project does not exist: ${projectRoot}`);
    process.exit(1);
  }

  const detected = defaultDevCommand(projectRoot, port);
  devCommand = devCommand ?? detected.command;
  if (startDev && !devCommand) {
    console.error(`${formatLabel("pickfix")} Could not infer a dev command. Pass --dev <command>.`);
    usage();
  }

  const targetUrl = target ?? `http://localhost:${port}`;
  return { projectRoot, devCommand, port, targetUrl, proxyPort, webPort, startDev, framework: detected.framework };
}

function handleChildFailure(labelName: string, message: string): void {
  if (shuttingDown) return;
  console.error(`${formatLabel("pickfix")} ${labelName} ${message}`);
  shutdown(1);
}

function prefixOutput(child: ChildProcess, labelName: string): void {
  const write = (stream: NodeJS.WriteStream, chunk: Buffer | string) => {
    const text = chunk.toString();
    for (const line of text.split(/\r?\n/)) {
      if (line.length > 0) stream.write(`${formatLabel(labelName)} ${line}\n`);
    }
  };

  child.stdout?.on("data", (chunk: Buffer) => write(process.stdout, chunk));
  child.stderr?.on("data", (chunk: Buffer) => write(process.stderr, chunk));
}

function startProcess(labelName: string, command: string, args: string[], cwd: string, env: NodeJS.ProcessEnv): ChildProcess {
  console.log(`${formatLabel("pickfix")} starting ${labelName}: ${command} ${args.join(" ")}`.trim());
  const child = spawn(command, args, {
    cwd,
    env: { ...process.env, ...env },
    stdio: ["ignore", "pipe", "pipe"],
    detached: true,
    shell: false,
  });
  children.push(child);
  prefixOutput(child, labelName);
  child.on("error", (err) => handleChildFailure(labelName, `failed to start: ${err.message}`));
  child.on("exit", (code, signal) => {
    if (!shuttingDown) {
      handleChildFailure(labelName, `exited with ${signal ?? code}`);
    }
  });
  return child;
}

function startShellProcess(labelName: string, command: string, cwd: string, env: NodeJS.ProcessEnv): ChildProcess {
  console.log(`${formatLabel("pickfix")} starting ${labelName}: ${command}`);
  const child = spawn(command, {
    cwd,
    env: { ...process.env, ...env },
    stdio: ["ignore", "pipe", "pipe"],
    detached: true,
    shell: true,
  });
  children.push(child);
  prefixOutput(child, labelName);
  child.on("error", (err) => handleChildFailure(labelName, `failed to start: ${err.message}`));
  child.on("exit", (code, signal) => {
    if (!shuttingDown) {
      handleChildFailure(labelName, `exited with ${signal ?? code}`);
    }
  });
  return child;
}

async function isReachable(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { method: "GET", signal: AbortSignal.timeout(1000) });
    await res.body?.cancel();
    return true;
  } catch {
    return false;
  }
}

async function waitForUrl(url: string, label: string): Promise<void> {
  console.log(`${formatLabel("pickfix")} waiting for ${label}: ${url}`);
  const startedAt = Date.now();
  while (!shuttingDown) {
    if (await isReachable(url)) {
      console.log(`${formatLabel("pickfix")} ${label} is ready`);
      return;
    }
    if (Date.now() - startedAt > WAIT_TIMEOUT_MS) {
      throw new Error(`${label} did not become reachable within ${WAIT_TIMEOUT_MS / 1000}s: ${url}`);
    }
    await new Promise((resolveSleep) => setTimeout(resolveSleep, 500));
  }
}

let shuttingDown = false;
function killProcessGroup(child: ChildProcess, signal: NodeJS.Signals): void {
  if (!child.pid) return;
  try {
    process.kill(-child.pid, signal);
  } catch {
    // Process may already be gone.
  }
}

function shutdown(exitCode = 0): void {
  if (shuttingDown) return;
  shuttingDown = true;
  process.exitCode = exitCode;
  for (const child of children) {
    killProcessGroup(child, "SIGTERM");
  }
  setTimeout(() => {
    for (const child of children) {
      killProcessGroup(child, "SIGKILL");
    }
    process.exit(exitCode);
  }, 2000).unref();
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  console.log(`${formatLabel("pickfix")} project: ${options.projectRoot}`);
  console.log(`${formatLabel("pickfix")} target:  ${options.targetUrl}`);
  if (options.framework) console.log(`${formatLabel("pickfix")} framework: ${options.framework}`);

  if (options.startDev) {
    startShellProcess("target", options.devCommand!, options.projectRoot, options.port ? { PORT: String(options.port) } : {});
  }
  await waitForUrl(options.targetUrl, "target");
  if (shuttingDown) return;

  startProcess("proxy", "pnpm", ["--filter", "@pickfix/proxy", "exec", "tsx", "src/server.ts"], workspaceRoot, {
    PF_TARGET_URL: options.targetUrl,
    PF_PROXY_PORT: String(options.proxyPort),
  });
  await waitForUrl(`http://localhost:${options.proxyPort}`, "proxy");
  if (shuttingDown) return;

  startProcess("web", "pnpm", ["--filter", "@pickfix/web", "exec", "next", "dev", "--port", String(options.webPort)], workspaceRoot, {
    NEXT_PUBLIC_PREVIEW_URL: `http://localhost:${options.proxyPort}`,
    PF_AGENT_CWD: options.projectRoot,
    PICKFIX_PROJECT_ROOT: options.projectRoot,
  });

  console.log(`${formatLabel("pickfix")} web: http://localhost:${options.webPort}`);
}

main().catch((error: unknown) => {
  console.error(`${formatLabel("pickfix")} ${error instanceof Error ? error.message : String(error)}`);
  shutdown(1);
});

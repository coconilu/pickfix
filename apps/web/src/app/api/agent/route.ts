import { spawn } from "node:child_process";
import path from "node:path";
import type { ChatMessage, ElementMeta } from "@/lib/bridge-protocol";

export const runtime = "nodejs";

interface AgentRequest {
  messages?: ChatMessage[];
  pickedElement?: ElementMeta | null;
  userMessage?: string;
  projectFiles?: Record<string, string>;
}

type ClaudeEvent = Record<string, unknown>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function buildPrompt(ctx: AgentRequest, repoRoot: string): string {
  const picked = ctx.pickedElement;
  const priorMessages = (ctx.messages ?? [])
    .filter((m) => m.role !== "system" && m.content.trim().length > 0)
    .slice(-8)
    .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
    .join("\n\n");

  return `You are PickFix, a local coding agent running through Claude Code.

PROJECT:
- Repository root: ${repoRoot}
- Main target app: examples/demo
- Web UI: apps/web
- Proxy: packages/proxy
- Bridge: packages/bridge

TASK:
The user is looking at the live preview and asks for a code change. Inspect and modify files directly when needed. Keep changes minimal and consistent with the existing codebase.

RULES:
1. Prefer modifying the actual source files instead of only describing changes.
2. If the picked element clearly belongs to the demo preview, start by inspecting examples/demo/src/app/page.tsx.
3. Preserve the existing style and avoid broad refactors unless requested.
4. After editing, briefly summarize what changed and which files were touched.
5. If you cannot safely make a change, explain the blocker and the exact next step.

${picked ? `PICKED ELEMENT:
- Tag: <${picked.tag}>
- ID: ${picked.id || "(none)"}
- Classes: ${picked.classes || "(none)"}
- Text: ${JSON.stringify(picked.text)}
- Selector: ${picked.selector}
- HTML hint: ${picked.htmlHint}
- Styles: ${picked.style ? JSON.stringify(picked.style) : "unknown"}
- Rect: x${picked.rect.x} y${picked.rect.y} ${picked.rect.width}x${picked.rect.height}
` : "PICKED ELEMENT: none"}

${priorMessages ? `RECENT CONVERSATION:\n${priorMessages}\n` : ""}

USER REQUEST:
${ctx.userMessage ?? ""}
`;
}

function extractTextFromClaudeEvent(obj: ClaudeEvent): string {
  if (obj.type === "stream_event" && isRecord(obj.event)) {
    const ev = obj.event;
    if (ev.type === "content_block_delta" && isRecord(ev.delta)) {
      const delta = ev.delta;
      if (delta.type === "text_delta" && typeof delta.text === "string") {
        return delta.text;
      }
    }
    return "";
  }

  if (obj.type === "assistant" && isRecord(obj.message) && Array.isArray(obj.message.content)) {
    return obj.message.content
      .map((block) => {
        if (!isRecord(block)) return "";
        if (block.type === "text" && typeof block.text === "string") return block.text;
        return "";
      })
      .join("");
  }

  return "";
}

function writeText(controller: ReadableStreamDefaultController<Uint8Array>, text: string): void {
  if (!text) return;
  controller.enqueue(new TextEncoder().encode(text));
}

export async function POST(req: Request): Promise<Response> {
  let body: AgentRequest;
  try {
    body = await req.json();
  } catch {
    return new Response("Invalid JSON body", { status: 400 });
  }

  const userMessage = body.userMessage?.trim();
  if (!userMessage) {
    return new Response("userMessage is required", { status: 400 });
  }

  const claudeBin = process.env.CLAUDE_BIN || "claude";
  const cwd = process.env.PF_AGENT_CWD || path.resolve(process.cwd(), "../..");
  const prompt = buildPrompt({ ...body, userMessage }, cwd);
  let child: ReturnType<typeof spawn> | null = null;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const spawned = spawn(
        claudeBin,
        ["-p", "--output-format", "stream-json", "--verbose"],
        {
          cwd,
          env: process.env,
          stdio: ["pipe", "pipe", "pipe"],
          shell: false,
        },
      );
      child = spawned;

      let stdoutBuffer = "";
      let stderrTail = "";
      let emittedText = false;
      let closed = false;

      const closeWithError = (message: string) => {
        if (closed) return;
        closed = true;
        writeText(controller, `\n\n⚠️ Claude Code failed: ${message}`);
        controller.close();
      };

      spawned.stdout.setEncoding("utf8");
      spawned.stderr.setEncoding("utf8");

      spawned.stdout.on("data", (chunk: string) => {
        stdoutBuffer += chunk;
        let newlineIndex = stdoutBuffer.indexOf("\n");
        while (newlineIndex !== -1) {
          const line = stdoutBuffer.slice(0, newlineIndex).trim();
          stdoutBuffer = stdoutBuffer.slice(newlineIndex + 1);
          if (line) {
            try {
              const text = extractTextFromClaudeEvent(JSON.parse(line));
              if (text) emittedText = true;
              writeText(controller, text);
            } catch {
              emittedText = true;
              writeText(controller, line + "\n");
            }
          }
          newlineIndex = stdoutBuffer.indexOf("\n");
        }
      });

      spawned.stderr.on("data", (chunk: string) => {
        stderrTail = `${stderrTail}${chunk}`.slice(-4000);
      });

      spawned.on("error", (err) => {
        closeWithError(
          err.message.includes("ENOENT")
            ? `Claude Code executable not found. Install Claude Code or set CLAUDE_BIN. (${err.message})`
            : err.message,
        );
      });

      spawned.on("close", (code) => {
        if (closed) return;
        const rem = stdoutBuffer.trim();
        if (rem) {
          try {
            const text = extractTextFromClaudeEvent(JSON.parse(rem));
            if (text) emittedText = true;
            writeText(controller, text);
          } catch {
            emittedText = true;
            writeText(controller, rem + "\n");
          }
        }

        if (code && code !== 0) {
          closeWithError(stderrTail.trim() || `process exited with code ${code}`);
          return;
        }

        if (!emittedText && stderrTail.trim()) {
          writeText(controller, `\n\n${stderrTail.trim()}`);
        }

        closed = true;
        controller.close();
      });

      spawned.stdin.on("error", () => {});
      spawned.stdin.end(prompt);
    },
    cancel() {
      child?.kill();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache, no-store, must-revalidate",
    },
  });
}

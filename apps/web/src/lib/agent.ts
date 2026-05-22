/**
 * Client-side agent transport for PickFix.
 *
 * The actual agent runs server-side in /api/agent so local CLI credentials and
 * filesystem access never move into the browser bundle.
 */
import type { ElementMeta, ChatMessage } from "./bridge-protocol";

export interface AgentContext {
  messages: ChatMessage[];
  pickedElement: ElementMeta | null;
  userMessage: string;
  projectFiles: Record<string, string>;
}

export interface AgentStatus {
  available: boolean;
  bin: string;
  version?: string;
  model?: string;
  error?: string;
  checkedAt: number;
}

export async function fetchAgentStatus(): Promise<AgentStatus> {
  const res = await fetch("/api/agent/status", { cache: "no-store" });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(detail || `Agent status check failed with ${res.status}`);
  }
  return res.json();
}

/**
 * Stream the agent's response for a user message with optional picked element.
 */
export async function streamAgentResponse(
  ctx: AgentContext,
  onChunk: (text: string) => void,
  options: { signal?: AbortSignal } = {},
): Promise<string> {
  const res = await fetch("/api/agent", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(ctx),
    signal: options.signal,
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(detail || `Agent request failed with ${res.status}`);
  }

  if (!res.body) {
    throw new Error("Agent response did not include a stream.");
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let fullText = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value, { stream: true });
    if (!chunk) continue;
    fullText += chunk;
    onChunk(chunk);
  }

  const tail = decoder.decode();
  if (tail) {
    fullText += tail;
    onChunk(tail);
  }

  return fullText;
}

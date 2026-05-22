import { describe, expect, it, vi } from "vitest";
import { runChatTurn } from "./ChatPanel";
import type { ChatMessage, ElementMeta } from "@/lib/bridge-protocol";

function element(overrides: Partial<ElementMeta> = {}): ElementMeta {
  return {
    elementId: "hero-title",
    tag: "h1",
    id: "",
    classes: "hero-title",
    text: "Launch faster",
    rect: { x: 1, y: 2, width: 300, height: 80 },
    selector: "body > h1:nth-of-type(1)",
    htmlHint: "<h1>Launch faster</h1>",
    style: null,
    ...overrides,
  };
}

function actions() {
  return {
    addMessage: vi.fn(),
    appendToLastAssistant: vi.fn(),
    setStreaming: vi.fn(),
    clearPickedElements: vi.fn(),
  };
}

describe("runChatTurn", () => {
  it("adds user and assistant messages, streams chunks, and resets state", async () => {
    const picked = [element({ elementId: "first" }), element({ elementId: "last" })];
    const currentMessages: ChatMessage[] = [
      { id: "old", role: "assistant", content: "Earlier" },
    ];
    const a = actions();
    const streamAgentResponseImpl = vi.fn(async (_ctx, onChunk) => {
      onChunk("Done");
      onChunk(".");
      return "Done.";
    });

    await runChatTurn({
      userText: "Make it blue",
      currentMessages,
      pickedElements: picked,
      actions: a,
      streamAgentResponseImpl,
    });

    expect(a.addMessage).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        role: "user",
        content: "Make it blue",
        pickedElement: expect.objectContaining({ elementId: "last" }),
      }),
    );
    expect(a.addMessage).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ role: "assistant", content: "" }),
    );
    expect(a.setStreaming).toHaveBeenNthCalledWith(1, true);
    expect(streamAgentResponseImpl).toHaveBeenCalledWith(
      {
        messages: currentMessages,
        pickedElement: picked[1],
        userMessage: "Make it blue",
        projectFiles: {},
        model: undefined,
      },
      expect.any(Function),
      { signal: undefined },
    );
    expect(a.appendToLastAssistant).toHaveBeenNthCalledWith(1, "Done");
    expect(a.appendToLastAssistant).toHaveBeenNthCalledWith(2, ".");
    expect(a.setStreaming).toHaveBeenLastCalledWith(false);
    expect(a.clearPickedElements).toHaveBeenCalledTimes(1);
  });

  it("writes an error message and still resets state when streaming fails", async () => {
    const a = actions();
    const streamAgentResponseImpl = vi.fn(async () => {
      throw new Error("Claude unavailable");
    });

    await runChatTurn({
      userText: "Change copy",
      currentMessages: [],
      pickedElements: [],
      actions: a,
      streamAgentResponseImpl,
    });

    expect(a.appendToLastAssistant).toHaveBeenCalledWith(
      "⚠️ Agent request failed: Claude unavailable",
    );
    expect(a.setStreaming).toHaveBeenNthCalledWith(1, true);
    expect(a.setStreaming).toHaveBeenLastCalledWith(false);
    expect(a.clearPickedElements).toHaveBeenCalledTimes(1);
  });

  it("marks the assistant response as stopped when aborted", async () => {
    const a = actions();
    const abortError = new Error("The operation was aborted.");
    abortError.name = "AbortError";
    const streamAgentResponseImpl = vi.fn(async () => {
      throw abortError;
    });

    await runChatTurn({
      userText: "Stop this",
      currentMessages: [],
      pickedElements: [],
      actions: a,
      streamAgentResponseImpl,
    });

    expect(a.appendToLastAssistant).toHaveBeenCalledWith("\n\n⏹️ Stopped.");
    expect(a.appendToLastAssistant).not.toHaveBeenCalledWith(
      expect.stringContaining("Agent request failed"),
    );
    expect(a.setStreaming).toHaveBeenLastCalledWith(false);
    expect(a.clearPickedElements).toHaveBeenCalledTimes(1);
  });
});

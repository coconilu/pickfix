import { describe, expect, it } from "vitest";
import {
  createInitialSessionState,
  parsePersistedSession,
  projectSessionStorageKey,
  reduceSessionState,
  serializePersistedSession,
  type SessionState,
} from "./session";
import type { ChatMessage, ElementMeta } from "@/lib/bridge-protocol";

function element(overrides: Partial<ElementMeta> = {}): ElementMeta {
  return {
    elementId: "hero-title",
    tag: "h1",
    id: "",
    classes: "hero-title",
    text: "Launch faster",
    rect: { x: 1, y: 2, width: 300, height: 80 },
    selector: "body > main:nth-of-type(1) > h1:nth-of-type(1)",
    htmlHint: "<h1>Launch faster</h1>",
    style: null,
    ...overrides,
  };
}

describe("SessionProvider state reducer", () => {
  it("creates the initial session state", () => {
    expect(createInitialSessionState("http://localhost:4000")).toEqual({
      pickMode: false,
      activeElement: null,
      pickedElements: [],
      messages: [],
      previewUrl: "http://localhost:4000",
      isStreaming: false,
      claudeModel: "default",
    });
  });

  it("sets the Claude model", () => {
    const next = reduceSessionState(createInitialSessionState("/"), {
      type: "setClaudeModel",
      model: "sonnet",
    });

    expect(next.claudeModel).toBe("sonnet");
  });

  it("setPickMode clears the active element", () => {
    const initial: SessionState = {
      ...createInitialSessionState("/"),
      activeElement: element(),
    };

    const next = reduceSessionState(initial, {
      type: "setPickMode",
      enabled: true,
    });

    expect(next.pickMode).toBe(true);
    expect(next.activeElement).toBeNull();
  });

  it("adds picked elements and dedupes by elementId", () => {
    const initial = createInitialSessionState("/");
    const picked = element();

    const once = reduceSessionState(initial, {
      type: "addPickedElement",
      element: picked,
    });
    const twice = reduceSessionState(once, {
      type: "addPickedElement",
      element: { ...picked, text: "Duplicate" },
    });

    expect(once.pickedElements).toEqual([picked]);
    expect(once.activeElement).toBe(picked);
    expect(twice).toBe(once);
  });

  it("removes picked elements and clears activeElement when needed", () => {
    const first = element({ elementId: "first" });
    const second = element({ elementId: "second" });
    const initial: SessionState = {
      ...createInitialSessionState("/"),
      activeElement: first,
      pickedElements: [first, second],
    };

    const next = reduceSessionState(initial, {
      type: "removePickedElement",
      elementId: "first",
    });

    expect(next.pickedElements).toEqual([second]);
    expect(next.activeElement).toBeNull();
  });

  it("restores a picked element for prompt prefill", () => {
    const restored = element({ elementId: "restored" });
    const initial: SessionState = {
      ...createInitialSessionState("/"),
      activeElement: element({ elementId: "old" }),
      pickedElements: [element({ elementId: "old" })],
    };

    const next = reduceSessionState(initial, {
      type: "restorePickedElement",
      element: restored,
    });

    expect(next.pickedElements).toEqual([restored]);
    expect(next.activeElement).toBe(restored);
  });

  it("appends chunks only to the latest assistant message", () => {
    const assistant: ChatMessage = {
      id: "assistant-1",
      role: "assistant",
      content: "Hello",
    };
    const withAssistant: SessionState = {
      ...createInitialSessionState("/"),
      messages: [assistant],
    };

    const appended = reduceSessionState(withAssistant, {
      type: "appendToLastAssistant",
      chunk: " world",
    });

    expect(appended.messages[0].content).toBe("Hello world");

    const withUserLast: SessionState = {
      ...createInitialSessionState("/"),
      messages: [{ id: "user-1", role: "user", content: "Hi" }],
    };
    const unchanged = reduceSessionState(withUserLast, {
      type: "appendToLastAssistant",
      chunk: " ignored",
    });

    expect(unchanged.messages).toEqual(withUserLast.messages);
  });

  it("clears picked elements and active element", () => {
    const initial: SessionState = {
      ...createInitialSessionState("/"),
      activeElement: element(),
      pickedElements: [element()],
    };

    const next = reduceSessionState(initial, { type: "clearPickedElements" });

    expect(next.pickedElements).toEqual([]);
    expect(next.activeElement).toBeNull();
  });
});

describe("session persistence helpers", () => {
  it("creates a project-scoped storage key", () => {
    expect(projectSessionStorageKey("abc123")).toBe("pickfix:session:abc123");
  });

  it("serializes and parses persisted messages and model", () => {
    const state: SessionState = {
      ...createInitialSessionState("/"),
      messages: [{ id: "user-1", role: "user", content: "Make it blue" }],
      claudeModel: "sonnet",
      pickMode: true,
      pickedElements: [element()],
      activeElement: element(),
      isStreaming: true,
    };

    expect(parsePersistedSession(serializePersistedSession(state))).toEqual({
      messages: [{ id: "user-1", role: "user", content: "Make it blue" }],
      claudeModel: "sonnet",
    });
  });

  it("ignores invalid persisted session payloads", () => {
    expect(parsePersistedSession("not json")).toBeNull();
    expect(parsePersistedSession(JSON.stringify({ version: 999, messages: [] }))).toBeNull();
  });
});

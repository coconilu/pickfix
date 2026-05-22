import { describe, expect, it } from "vitest";
import { buildPrompt } from "./route";
import type { ChatMessage, ElementMeta } from "@/lib/bridge-protocol";

function pickedElement(): ElementMeta {
  return {
    elementId: "hero-title",
    tag: "h1",
    id: "",
    classes: "hero title",
    text: "Welcome",
    rect: { x: 1, y: 2, width: 300, height: 64 },
    selector: "body > div > h1",
    htmlHint: "<h1 class=\"hero title\">Welcome</h1>",
    style: {
      color: "rgb(0, 0, 0)",
      backgroundColor: "rgba(0, 0, 0, 0)",
      fontSize: "32px",
      fontWeight: "700",
    },
  };
}

describe("agent prompt", () => {
  it("includes framework-aware editing guidance and picked element context", () => {
    const messages: ChatMessage[] = [
      { id: "user-1", role: "user", content: "Make it warmer" },
      { id: "assistant-1", role: "assistant", content: "Changed app.vue" },
    ];

    const prompt = buildPrompt(
      {
        messages,
        pickedElement: pickedElement(),
        userMessage: "Make this title blue",
      },
      "/tmp/my-nuxt-app",
    );

    expect(prompt).toContain("Target project root: /tmp/my-nuxt-app");
    expect(prompt).toContain("For Nuxt/Vue projects");
    expect(prompt).toContain("For Next/React projects");
    expect(prompt).toContain("Do not edit dependencies, generated output");
    expect(prompt).toContain("Make the smallest source change");
    expect(prompt).toContain("HTML hint: <h1 class=\"hero title\">Welcome</h1>");
    expect(prompt).toContain("RECENT CONVERSATION");
    expect(prompt).toContain("USER REQUEST:\nMake this title blue");
  });
});

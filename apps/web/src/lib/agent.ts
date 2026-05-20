/**
 * Agent integration for PickFix.
 * MVP: Uses Vercel AI SDK with OpenAI to modify code based on
 * picked elements and user instructions.
 *
 * Set OPENAI_API_KEY in environment to enable.
 */
import { streamText } from "ai";
import { openai } from "@ai-sdk/openai";
import type { ElementMeta, ChatMessage } from "./bridge-protocol";

export interface AgentContext {
  messages: ChatMessage[];
  pickedElement: ElementMeta | null;
  userMessage: string;
  projectFiles: Record<string, string>;
}

/**
 * Build the system prompt for the agent.
 */
function buildSystemPrompt(ctx: AgentContext): string {
  const fileList = Object.keys(ctx.projectFiles).join(", ");

  let prompt = `You are PickFix, an AI coding agent that helps users modify their web application through a live preview. 

You have access to the project source files. The user is looking at a live preview of their app and has picked an element they want to change.

AVAILABLE FILES: ${fileList}

RULES:
1. When the user asks for a change, identify which file(s) need to be modified
2. Provide the exact code changes — show the full modified file content
3. Keep changes minimal and surgical — only change what's requested
4. Use the same coding style and conventions as the existing code
5. If you need to see content of other files, mention which ones
6. Format your code changes clearly with the full file path and content

RESPONSE FORMAT:
For each file you modify, output:

\`\`\`file:path/to/file.tsx
// Full file content with changes applied
\`\`\`

Then briefly explain what you changed and why.
`;

  if (ctx.pickedElement) {
    const el = ctx.pickedElement;
    prompt += `
PICKED ELEMENT CONTEXT:
- Tag: <${el.tag}> 
- Classes: ${el.classes || "(none)"}
- ID: ${el.id || "(none)"}
- Text content: "${el.text}"
- CSS selector: ${el.selector}
- HTML hint: ${el.htmlHint}
- Styles: ${el.style ? JSON.stringify(el.style) : "unknown"}
- Position: x${el.rect.x} y${el.rect.y} ${el.rect.width}x${el.rect.height}
`;
  }

  prompt += `
CURRENT PROJECT FILES:
`;
  for (const [path, content] of Object.entries(ctx.projectFiles)) {
    prompt += `\n=== ${path} ===\n${content}\n`;
  }

  return prompt;
}

/**
 * Stream the agent's response for a user message with optional picked element.
 */
export async function streamAgentResponse(
  ctx: AgentContext,
  onChunk: (text: string) => void,
): Promise<string> {
  const systemPrompt = buildSystemPrompt(ctx);

  try {
    const result = await streamText({
      model: openai("gpt-4o-mini"),
      system: systemPrompt,
      messages: [
        ...ctx.messages
          .filter((m) => m.role !== "system")
          .map((m) => ({
            role: m.role as "user" | "assistant",
            content: m.content,
          })),
        {
          role: "user" as const,
          content: ctx.userMessage,
        },
      ],
      temperature: 0.3,
    });

    let fullText = "";
    for await (const chunk of result.textStream) {
      fullText += chunk;
      onChunk(chunk);
    }
    return fullText;
  } catch (error) {
    const message =
      "⚠️ Agent not configured. Set OPENAI_API_KEY in your environment.\n\n" +
      "In the meantime, here's what I would do:\n\n" +
      "1. Find the picked element in your source files\n" +
      "2. Apply the changes you requested\n" +
      "3. HMR will automatically update the preview\n\n" +
      `Error: ${error instanceof Error ? error.message : String(error)}`;
    return message;
  }
}

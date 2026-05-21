"use client";

import { useRef, useEffect, useCallback } from "react";
import { useSessionState, useSessionActions } from "@/providers/session";
import { PickedElement } from "./PickedElement";
import { streamAgentResponse } from "@/lib/agent";
import type { ChatMessage, ElementMeta } from "@/lib/bridge-protocol";

interface ChatTurnActions {
  addMessage: (msg: ChatMessage) => void;
  appendToLastAssistant: (chunk: string) => void;
  setStreaming: (value: boolean) => void;
  clearPickedElements: () => void;
}

export async function runChatTurn({
  userText,
  currentMessages,
  pickedElements,
  actions,
  streamAgentResponseImpl = streamAgentResponse,
}: {
  userText: string;
  currentMessages: ChatMessage[];
  pickedElements: ElementMeta[];
  actions: ChatTurnActions;
  streamAgentResponseImpl?: typeof streamAgentResponse;
}): Promise<void> {
  const lastPicked =
    pickedElements.length > 0 ? pickedElements[pickedElements.length - 1] : null;

  const userMsg: ChatMessage = {
    id: `user-${Date.now()}`,
    role: "user",
    content: userText,
    pickedElement: lastPicked,
  };
  actions.addMessage(userMsg);

  const assistantMsg: ChatMessage = {
    id: `assistant-${Date.now()}`,
    role: "assistant",
    content: "",
  };
  actions.addMessage(assistantMsg);
  actions.setStreaming(true);

  try {
    await streamAgentResponseImpl(
      {
        messages: currentMessages,
        pickedElement: lastPicked,
        userMessage: userText,
        projectFiles: {},
      },
      (chunk) => actions.appendToLastAssistant(chunk),
    );
  } catch (error) {
    actions.appendToLastAssistant(
      `⚠️ Agent request failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  } finally {
    actions.setStreaming(false);
    actions.clearPickedElements();
  }
}

export function ChatPanel() {
  const { messages, pickedElements, activeElement, isStreaming } =
    useSessionState();
  const { addMessage, appendToLastAssistant, setStreaming, clearPickedElements, removePickedElement } =
    useSessionActions();

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  // Track latest messages via ref to avoid stale closures
  const messagesRef = useRef(messages);
  messagesRef.current = messages;
  const pickedElementsRef = useRef(pickedElements);
  pickedElementsRef.current = pickedElements;

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = useCallback(async () => {
    const input = inputRef.current;
    if (!input || !input.value.trim() || isStreaming) return;

    const userText = input.value.trim();
    input.value = "";
    input.style.height = "auto";

    // Use ref to get latest messages (avoids stale closure)
    const currentMessages = messagesRef.current;

    await runChatTurn({
      userText,
      currentMessages,
      pickedElements: pickedElementsRef.current,
      actions: {
        addMessage,
        appendToLastAssistant,
        setStreaming,
        clearPickedElements,
      },
    });
  }, [isStreaming, addMessage, appendToLastAssistant, setStreaming, clearPickedElements]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  return (
    <div className="chat-panel">
      <div className="chat-panel-header">
        <h2 className="chat-panel-title">Agent Chat</h2>
        <span className="chat-panel-badge">
          {pickedElements.length > 0
            ? `${pickedElements.length} element${pickedElements.length > 1 ? "s" : ""} picked`
            : "No element picked"}
        </span>
      </div>

      {pickedElements.length > 0 && (
        <div className="chat-picked-bar">
          {pickedElements.map((el) => (
            <PickedElement
              key={el.elementId}
              element={el}
              onRemove={() => removePickedElement(el.elementId)}
            />
          ))}
        </div>
      )}

      <div className="chat-messages">
        {messages.length === 0 && (
          <div className="chat-empty">
            <div className="chat-empty-icon">☝️</div>
            <p>Click elements in the preview to pick them, then describe what you want to change.</p>
          </div>
        )}
        {messages.map((msg) => (
          <div key={msg.id} className={`chat-message chat-message-${msg.role}`}>
            <div className="chat-message-role">
              {msg.role === "user" ? "You" : "Agent"}
            </div>
            {msg.pickedElement && (
              <div className="chat-message-element">
                📌 Picked: &lt;{msg.pickedElement.tag}&gt;{" "}
                {msg.pickedElement.classes
                  ? `.${msg.pickedElement.classes.split(/\s+/)[0]}`
                  : ""}{" "}
                — &quot;{msg.pickedElement.text.slice(0, 40)}&quot;
              </div>
            )}
            <div className="chat-message-content">
              {msg.content || (msg.role === "assistant" && isStreaming ? "..." : "")}
            </div>
          </div>
        ))}
        <div ref={chatEndRef} />
      </div>

      <div className="chat-input-area">
        <textarea
          ref={inputRef}
          className="chat-input"
          placeholder={
            activeElement
              ? `Describe changes to ${activeElement.tag}... (Enter to send)`
              : "Pick an element, then describe changes... (Enter to send)"
          }
          rows={2}
          onKeyDown={handleKeyDown}
          disabled={isStreaming}
        />
        <button
          className="chat-send-btn"
          onClick={handleSend}
          disabled={isStreaming || !inputRef.current?.value.trim()}
        >
          {isStreaming ? "..." : "Send"}
        </button>
      </div>
    </div>
  );
}

"use client";

import { useRef, useEffect } from "react";
import { useSessionState, useSessionActions } from "@/providers/session";
import { PickedElement } from "./PickedElement";
import { streamAgentResponse } from "@/lib/agent";
import type { ElementMeta, ChatMessage } from "@/lib/bridge-protocol";

/** Mock project files for the MVP agent context. */
const MOCK_PROJECT_FILES: Record<string, string> = {};

export function ChatPanel() {
  const { messages, pickedElements, activeElement, isStreaming } =
    useSessionState();
  const { addMessage, appendToLastAssistant, setStreaming, clearPickedElements } =
    useSessionActions();

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    const input = inputRef.current;
    if (!input || !input.value.trim() || isStreaming) return;

    const userText = input.value.trim();
    input.value = "";
    input.style.height = "auto";

    // Get the last picked element as context
    const lastPicked =
      pickedElements.length > 0
        ? pickedElements[pickedElements.length - 1]
        : null;

    // Add user message
    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: userText,
      pickedElement: lastPicked,
    };
    addMessage(userMsg);

    // Add placeholder assistant message
    const assistantMsg: ChatMessage = {
      id: `assistant-${Date.now()}`,
      role: "assistant",
      content: "",
    };
    addMessage(assistantMsg);
    setStreaming(true);

    // Stream agent response
    await streamAgentResponse(
      {
        messages,
        pickedElement: lastPicked,
        userMessage: userText,
        projectFiles: MOCK_PROJECT_FILES,
      },
      (chunk) => appendToLastAssistant(chunk),
    );

    setStreaming(false);
    clearPickedElements();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

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

      {/* Picked elements bar */}
      {pickedElements.length > 0 && (
        <div className="chat-picked-bar">
          {pickedElements.map((el) => (
            <PickedElement
              key={el.elementId}
              element={el}
              onRemove={() => {
                // handled in parent
              }}
            />
          ))}
        </div>
      )}

      {/* Messages */}
      <div className="chat-messages">
        {messages.length === 0 && (
          <div className="chat-empty">
            <div className="chat-empty-icon">☝️</div>
            <p>
              Click elements in the preview to pick them, then describe what you
              want to change.
            </p>
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
                — "{msg.pickedElement.text.slice(0, 40)}"
              </div>
            )}
            <div className="chat-message-content">
              {msg.content || (msg.role === "assistant" && isStreaming ? "..." : "")}
            </div>
          </div>
        ))}
        <div ref={chatEndRef} />
      </div>

      {/* Input */}
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

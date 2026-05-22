"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { ElementMeta, ChatMessage } from "@/lib/bridge-protocol";

export type ClaudeModel = "default" | "sonnet" | "opus" | "haiku";

export interface SessionState {
  pickMode: boolean;
  activeElement: ElementMeta | null;
  pickedElements: ElementMeta[];
  messages: ChatMessage[];
  previewUrl: string;
  isStreaming: boolean;
  claudeModel: ClaudeModel;
}

export type SessionStateUpdate =
  | { type: "setPickMode"; enabled: boolean }
  | { type: "setActiveElement"; element: ElementMeta | null }
  | { type: "addPickedElement"; element: ElementMeta }
  | { type: "removePickedElement"; elementId: string }
  | { type: "restorePickedElement"; element: ElementMeta }
  | { type: "addMessage"; message: ChatMessage }
  | { type: "appendToLastAssistant"; chunk: string }
  | { type: "setStreaming"; value: boolean }
  | { type: "clearPickedElements" }
  | { type: "setPreviewUrl"; url: string }
  | { type: "setClaudeModel"; model: ClaudeModel };

export function createInitialSessionState(previewUrl: string): SessionState {
  return {
    pickMode: false,
    activeElement: null,
    pickedElements: [],
    messages: [],
    previewUrl,
    isStreaming: false,
    claudeModel: "default",
  };
}

export function reduceSessionState(
  state: SessionState,
  update: SessionStateUpdate,
): SessionState {
  switch (update.type) {
    case "setPickMode":
      return { ...state, pickMode: update.enabled, activeElement: null };
    case "setActiveElement":
      return { ...state, activeElement: update.element };
    case "addPickedElement": {
      const exists = state.pickedElements.find(
        (p) => p.elementId === update.element.elementId,
      );
      if (exists) return state;
      return {
        ...state,
        pickedElements: [...state.pickedElements, update.element],
        activeElement: update.element,
      };
    }
    case "removePickedElement":
      return {
        ...state,
        pickedElements: state.pickedElements.filter(
          (p) => p.elementId !== update.elementId,
        ),
        activeElement:
          state.activeElement?.elementId === update.elementId
            ? null
            : state.activeElement,
      };
    case "restorePickedElement":
      return {
        ...state,
        pickedElements: [update.element],
        activeElement: update.element,
      };
    case "addMessage":
      return { ...state, messages: [...state.messages, update.message] };
    case "appendToLastAssistant": {
      const messages = [...state.messages];
      const last = messages[messages.length - 1];
      if (last && last.role === "assistant") {
        messages[messages.length - 1] = {
          ...last,
          content: last.content + update.chunk,
        };
      }
      return { ...state, messages };
    }
    case "setStreaming":
      return { ...state, isStreaming: update.value };
    case "clearPickedElements":
      return { ...state, pickedElements: [], activeElement: null };
    case "setPreviewUrl":
      return { ...state, previewUrl: update.url };
    case "setClaudeModel":
      return { ...state, claudeModel: update.model };
  }
}

interface SessionActions {
  setPickMode: (enabled: boolean) => void;
  setActiveElement: (el: ElementMeta | null) => void;
  addPickedElement: (el: ElementMeta) => void;
  removePickedElement: (elementId: string) => void;
  restorePickedElement: (el: ElementMeta) => void;
  addMessage: (msg: ChatMessage) => void;
  appendToLastAssistant: (chunk: string) => void;
  setStreaming: (v: boolean) => void;
  clearPickedElements: () => void;
  setPreviewUrl: (url: string) => void;
  setClaudeModel: (model: ClaudeModel) => void;
}

const SessionStateCtx = createContext<SessionState | null>(null);
const SessionActionsCtx = createContext<SessionActions | null>(null);

export function SessionProvider({
  children,
  previewUrl,
}: {
  children: ReactNode;
  previewUrl: string;
}) {
  const [state, setState] = useState<SessionState>(() =>
    createInitialSessionState(previewUrl),
  );

  const setPickMode = useCallback((enabled: boolean) => {
    setState((s) => reduceSessionState(s, { type: "setPickMode", enabled }));
  }, []);

  const setActiveElement = useCallback((el: ElementMeta | null) => {
    setState((s) => reduceSessionState(s, { type: "setActiveElement", element: el }));
  }, []);

  const addPickedElement = useCallback((el: ElementMeta) => {
    setState((s) => reduceSessionState(s, { type: "addPickedElement", element: el }));
  }, []);

  const removePickedElement = useCallback((elementId: string) => {
    setState((s) => reduceSessionState(s, { type: "removePickedElement", elementId }));
  }, []);

  const restorePickedElement = useCallback((el: ElementMeta) => {
    setState((s) => reduceSessionState(s, { type: "restorePickedElement", element: el }));
  }, []);

  const addMessage = useCallback((msg: ChatMessage) => {
    setState((s) => reduceSessionState(s, { type: "addMessage", message: msg }));
  }, []);

  const appendToLastAssistant = useCallback((chunk: string) => {
    setState((s) => reduceSessionState(s, { type: "appendToLastAssistant", chunk }));
  }, []);

  const setStreaming = useCallback((v: boolean) => {
    setState((s) => reduceSessionState(s, { type: "setStreaming", value: v }));
  }, []);

  const clearPickedElements = useCallback(() => {
    setState((s) => reduceSessionState(s, { type: "clearPickedElements" }));
  }, []);

  const setPreviewUrl = useCallback((url: string) => {
    setState((s) => reduceSessionState(s, { type: "setPreviewUrl", url }));
  }, []);

  const setClaudeModel = useCallback((model: ClaudeModel) => {
    setState((s) => reduceSessionState(s, { type: "setClaudeModel", model }));
  }, []);

  // Memoize the actions object so consumers don't re-render on every state change.
  const actions = useMemo<SessionActions>(
    () => ({
      setPickMode,
      setActiveElement,
      addPickedElement,
      removePickedElement,
      restorePickedElement,
      addMessage,
      appendToLastAssistant,
      setStreaming,
      clearPickedElements,
      setPreviewUrl,
      setClaudeModel,
    }),
    [
      setPickMode,
      setActiveElement,
      addPickedElement,
      removePickedElement,
      restorePickedElement,
      addMessage,
      appendToLastAssistant,
      setStreaming,
      clearPickedElements,
      setPreviewUrl,
      setClaudeModel,
    ],
  );

  return (
    <SessionStateCtx.Provider value={state}>
      <SessionActionsCtx.Provider value={actions}>
        {children}
      </SessionActionsCtx.Provider>
    </SessionStateCtx.Provider>
  );
}

export function useSessionState() {
  const ctx = useContext(SessionStateCtx);
  if (!ctx) throw new Error("useSessionState must be used within SessionProvider");
  return ctx;
}

export function useSessionActions() {
  const ctx = useContext(SessionActionsCtx);
  if (!ctx) throw new Error("useSessionActions must be used within SessionProvider");
  return ctx;
}

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

export interface SessionState {
  pickMode: boolean;
  activeElement: ElementMeta | null;
  pickedElements: ElementMeta[];
  messages: ChatMessage[];
  previewUrl: string;
  isStreaming: boolean;
}

interface SessionActions {
  setPickMode: (enabled: boolean) => void;
  setActiveElement: (el: ElementMeta | null) => void;
  addPickedElement: (el: ElementMeta) => void;
  removePickedElement: (elementId: string) => void;
  addMessage: (msg: ChatMessage) => void;
  appendToLastAssistant: (chunk: string) => void;
  setStreaming: (v: boolean) => void;
  clearPickedElements: () => void;
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
  const [state, setState] = useState<SessionState>({
    pickMode: false,
    activeElement: null,
    pickedElements: [],
    messages: [],
    previewUrl,
    isStreaming: false,
  });

  const setPickMode = useCallback((enabled: boolean) => {
    setState((s) => ({ ...s, pickMode: enabled, activeElement: null }));
  }, []);

  const setActiveElement = useCallback((el: ElementMeta | null) => {
    setState((s) => ({ ...s, activeElement: el }));
  }, []);

  const addPickedElement = useCallback((el: ElementMeta) => {
    setState((s) => {
      const exists = s.pickedElements.find((p) => p.elementId === el.elementId);
      if (exists) return s;
      return { ...s, pickedElements: [...s.pickedElements, el], activeElement: el };
    });
  }, []);

  const removePickedElement = useCallback((elementId: string) => {
    setState((s) => ({
      ...s,
      pickedElements: s.pickedElements.filter((p) => p.elementId !== elementId),
      activeElement: s.activeElement?.elementId === elementId ? null : s.activeElement,
    }));
  }, []);

  const addMessage = useCallback((msg: ChatMessage) => {
    setState((s) => ({ ...s, messages: [...s.messages, msg] }));
  }, []);

  const appendToLastAssistant = useCallback((chunk: string) => {
    setState((s) => {
      const msgs = [...s.messages];
      const last = msgs[msgs.length - 1];
      if (last && last.role === "assistant") {
        msgs[msgs.length - 1] = { ...last, content: last.content + chunk };
      }
      return { ...s, messages: msgs };
    });
  }, []);

  const setStreaming = useCallback((v: boolean) => {
    setState((s) => ({ ...s, isStreaming: v }));
  }, []);

  const clearPickedElements = useCallback(() => {
    setState((s) => ({ ...s, pickedElements: [], activeElement: null }));
  }, []);

  // Memoize the actions object so consumers don't re-render on every state change.
  const actions = useMemo<SessionActions>(
    () => ({
      setPickMode,
      setActiveElement,
      addPickedElement,
      removePickedElement,
      addMessage,
      appendToLastAssistant,
      setStreaming,
      clearPickedElements,
    }),
    [
      setPickMode,
      setActiveElement,
      addPickedElement,
      removePickedElement,
      addMessage,
      appendToLastAssistant,
      setStreaming,
      clearPickedElements,
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

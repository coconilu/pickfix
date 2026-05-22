"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { ElementMeta, ChatMessage } from "@/lib/bridge-protocol";
import { fetchProjectInfo } from "@/lib/project";

export type ClaudeModel = "default" | "sonnet" | "opus" | "haiku";

export interface ProjectSessionSummary {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
}

export interface SessionState {
  sessionId: string;
  projectName: string;
  availableSessions: ProjectSessionSummary[];
  pickMode: boolean;
  activeElement: ElementMeta | null;
  pickedElements: ElementMeta[];
  messages: ChatMessage[];
  previewUrl: string;
  isStreaming: boolean;
  claudeModel: ClaudeModel;
}

const PERSISTED_SESSION_VERSION = 1;

interface PersistedSessionState {
  version: typeof PERSISTED_SESSION_VERSION;
  messages: ChatMessage[];
  claudeModel: ClaudeModel;
  updatedAt: number;
}

interface PersistedSessionIndex {
  version: 1;
  sessions: ProjectSessionSummary[];
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
  | { type: "setClaudeModel"; model: ClaudeModel }
  | { type: "restoreSession"; sessionId: string; persisted: Pick<SessionState, "messages" | "claudeModel"> | null }
  | { type: "setSessionMetadata"; projectName: string; availableSessions: ProjectSessionSummary[] };

export const DEFAULT_SESSION_ID = "default";

export function createInitialSessionState(previewUrl: string): SessionState {
  return {
    sessionId: DEFAULT_SESSION_ID,
    projectName: "Project",
    availableSessions: [],
    pickMode: false,
    activeElement: null,
    pickedElements: [],
    messages: [],
    previewUrl,
    isStreaming: false,
    claudeModel: "default",
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isClaudeModel(value: unknown): value is ClaudeModel {
  return value === "default" || value === "sonnet" || value === "opus" || value === "haiku";
}

function isChatMessage(value: unknown): value is ChatMessage {
  return isRecord(value)
    && typeof value.id === "string"
    && (value.role === "user" || value.role === "assistant" || value.role === "system")
    && typeof value.content === "string";
}

export function projectSessionStorageKey(projectKey: string): string {
  return `pickfix:session:${projectKey}`;
}

export function projectSessionContentStorageKey(projectKey: string, sessionId = DEFAULT_SESSION_ID): string {
  if (sessionId === DEFAULT_SESSION_ID) return projectSessionStorageKey(projectKey);
  return `pickfix:session:${projectKey}:${sessionId}`;
}

export function projectSessionIndexStorageKey(projectKey: string): string {
  return `pickfix:sessions:${projectKey}`;
}

export function projectActiveSessionStorageKey(projectKey: string): string {
  return `pickfix:active-session:${projectKey}`;
}

export function createDefaultSessionSummary(now = Date.now()): ProjectSessionSummary {
  return {
    id: DEFAULT_SESSION_ID,
    title: "Session 1",
    createdAt: now,
    updatedAt: now,
  };
}

function isProjectSessionSummary(value: unknown): value is ProjectSessionSummary {
  return isRecord(value)
    && typeof value.id === "string"
    && typeof value.title === "string"
    && typeof value.createdAt === "number"
    && typeof value.updatedAt === "number";
}

export function parsePersistedSessionIndex(raw: string | null, now = Date.now()): ProjectSessionSummary[] {
  if (!raw) return [createDefaultSessionSummary(now)];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed) || parsed.version !== 1 || !Array.isArray(parsed.sessions)) {
      return [createDefaultSessionSummary(now)];
    }
    const sessions = parsed.sessions.filter(isProjectSessionSummary);
    return sessions.length > 0 ? sessions : [createDefaultSessionSummary(now)];
  } catch {
    return [createDefaultSessionSummary(now)];
  }
}

export function serializePersistedSessionIndex(sessions: ProjectSessionSummary[]): string {
  const persisted: PersistedSessionIndex = { version: 1, sessions };
  return JSON.stringify(persisted);
}

export function parsePersistedSession(raw: string | null): Pick<SessionState, "messages" | "claudeModel"> | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed) || parsed.version !== PERSISTED_SESSION_VERSION || !Array.isArray(parsed.messages)) {
      return null;
    }

    return {
      messages: parsed.messages.filter(isChatMessage),
      claudeModel: isClaudeModel(parsed.claudeModel) ? parsed.claudeModel : "default",
    };
  } catch {
    return null;
  }
}

export function serializePersistedSession(state: SessionState): string {
  const persisted: PersistedSessionState = {
    version: PERSISTED_SESSION_VERSION,
    messages: state.messages,
    claudeModel: state.claudeModel,
    updatedAt: Date.now(),
  };
  return JSON.stringify(persisted);
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
    case "restoreSession":
      return {
        ...state,
        sessionId: update.sessionId,
        pickMode: false,
        activeElement: null,
        pickedElements: [],
        messages: update.persisted?.messages ?? [],
        isStreaming: false,
        claudeModel: update.persisted?.claudeModel ?? "default",
      };
    case "setSessionMetadata":
      return {
        ...state,
        projectName: update.projectName,
        availableSessions: update.availableSessions,
      };
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
  createSession: () => void;
  switchSession: (sessionId: string) => void;
  deleteSession: (sessionId: string) => void;
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
  const [projectKey, setProjectKey] = useState<string | null>(null);
  const [storageKey, setStorageKey] = useState<string | null>(null);

  const updateSessions = useCallback((projectKeyValue: string, sessions: ProjectSessionSummary[]) => {
    window.localStorage.setItem(projectSessionIndexStorageKey(projectKeyValue), serializePersistedSessionIndex(sessions));
    setState((current) => reduceSessionState(current, {
      type: "setSessionMetadata",
      projectName: current.projectName,
      availableSessions: sessions,
    }));
  }, []);

  const switchToSession = useCallback((projectKeyValue: string, sessionId: string) => {
    const key = projectSessionContentStorageKey(projectKeyValue, sessionId);
    const persisted = parsePersistedSession(window.localStorage.getItem(key));
    window.localStorage.setItem(projectActiveSessionStorageKey(projectKeyValue), sessionId);
    setStorageKey(key);
    setState((current) => reduceSessionState(current, { type: "restoreSession", sessionId, persisted }));
  }, []);

  useEffect(() => {
    let cancelled = false;

    fetchProjectInfo()
      .then((project) => {
        if (cancelled) return;
        setProjectKey(project.key);
        const sessions = parsePersistedSessionIndex(window.localStorage.getItem(projectSessionIndexStorageKey(project.key)));
        window.localStorage.setItem(projectSessionIndexStorageKey(project.key), serializePersistedSessionIndex(sessions));
        const activeSessionId = window.localStorage.getItem(projectActiveSessionStorageKey(project.key));
        const sessionId = sessions.some((session) => session.id === activeSessionId) ? activeSessionId! : sessions[0].id;
        const key = projectSessionContentStorageKey(project.key, sessionId);
        const persisted = parsePersistedSession(window.localStorage.getItem(key));
        setStorageKey(key);
        setState((current) => {
          return {
            ...current,
            projectName: project.name,
            availableSessions: sessions,
            sessionId,
            messages: persisted?.messages ?? [],
            claudeModel: persisted?.claudeModel ?? "default",
          };
        });
      })
      .catch(() => {
        // Chat history persistence is best-effort; the app should still work without project metadata.
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!storageKey) return;
    window.localStorage.setItem(storageKey, serializePersistedSession(state));
    if (projectKey) {
      const now = Date.now();
      const sessions = state.availableSessions.map((session) => (
        session.id === state.sessionId ? { ...session, updatedAt: now } : session
      ));
      window.localStorage.setItem(projectSessionIndexStorageKey(projectKey), serializePersistedSessionIndex(sessions));
    }
  }, [state.messages, state.claudeModel, storageKey, projectKey, state.availableSessions, state.sessionId]);

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

  const createSession = useCallback(() => {
    if (!projectKey) return;
    const now = Date.now();
    const nextIndex = state.availableSessions.length + 1;
    const session: ProjectSessionSummary = {
      id: `session-${now.toString(36)}`,
      title: `Session ${nextIndex}`,
      createdAt: now,
      updatedAt: now,
    };
    const sessions = [...state.availableSessions, session];
    updateSessions(projectKey, sessions);
    switchToSession(projectKey, session.id);
  }, [projectKey, state.availableSessions, switchToSession, updateSessions]);

  const switchSession = useCallback((sessionId: string) => {
    if (!projectKey || sessionId === state.sessionId || state.isStreaming) return;
    if (!state.availableSessions.some((session) => session.id === sessionId)) return;
    switchToSession(projectKey, sessionId);
  }, [projectKey, state.availableSessions, state.isStreaming, state.sessionId, switchToSession]);

  const deleteSession = useCallback((sessionId: string) => {
    if (!projectKey || state.isStreaming) return;
    let sessions = state.availableSessions.filter((session) => session.id !== sessionId);
    if (sessions.length === 0) sessions = [createDefaultSessionSummary()];
    window.localStorage.removeItem(projectSessionContentStorageKey(projectKey, sessionId));
    updateSessions(projectKey, sessions);
    if (sessionId === state.sessionId) {
      switchToSession(projectKey, sessions[0].id);
    }
  }, [projectKey, state.availableSessions, state.isStreaming, state.sessionId, switchToSession, updateSessions]);

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
      createSession,
      switchSession,
      deleteSession,
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
      createSession,
      switchSession,
      deleteSession,
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

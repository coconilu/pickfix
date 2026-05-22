// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ChatPanel } from "./ChatPanel";

const sessionActions = vi.hoisted(() => ({
  addMessage: vi.fn(),
  appendToLastAssistant: vi.fn(),
  setStreaming: vi.fn(),
  clearPickedElements: vi.fn(),
  removePickedElement: vi.fn(),
  restorePickedElement: vi.fn(),
  createSession: vi.fn(),
  switchSession: vi.fn(),
  deleteSession: vi.fn(),
}));

const mockSessionState = vi.hoisted(() => ({
  sessionId: "default",
  projectName: "next-demo",
  availableSessions: [
    { id: "default", title: "Session 1", createdAt: 1, updatedAt: 1 },
    { id: "session-2", title: "Homepage fix", createdAt: 2, updatedAt: 2 },
  ],
  messages: [] as unknown[],
  pickedElements: [] as unknown[],
  activeElement: null,
  isStreaming: false,
  claudeModel: "default" as const,
}));

vi.mock("@/providers/session", () => ({
  useSessionState: () => mockSessionState,
  useSessionActions: () => sessionActions,
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  // Reset state to default
  mockSessionState.sessionId = "default";
  mockSessionState.projectName = "next-demo";
  mockSessionState.availableSessions = [
    { id: "default", title: "Session 1", createdAt: 1, updatedAt: 1 },
    { id: "session-2", title: "Homepage fix", createdAt: 2, updatedAt: 2 },
  ];
  mockSessionState.messages = [];
  mockSessionState.pickedElements = [];
  mockSessionState.activeElement = null;
  mockSessionState.isStreaming = false;
  mockSessionState.claudeModel = "default";
});

function openDropdown() {
  const trigger = screen.getByRole("button", { name: /Current session:/ });
  fireEvent.click(trigger);
  return screen.getByRole("listbox", { name: "Sessions" });
}

describe("ChatPanel layout", () => {
  it("renders session controls in the chat panel header", () => {
    render(<ChatPanel />);

    const chatTitle = screen.getByRole("heading", { name: "Agent Chat" });
    const chatPanelHeader = chatTitle.closest(".chat-panel-header");

    expect(chatPanelHeader).not.toBeNull();
    const header = chatPanelHeader as HTMLElement;
    expect(within(header).getByLabelText("Project sessions")).toBeTruthy();

    // The custom dropdown trigger shows current session name
    const trigger = within(header).getByRole("button", {
      name: /Current session:/,
    });
    expect(trigger).toBeTruthy();

    expect(within(header).getByRole("button", { name: "Add new session" })).toBeTruthy();

    // Dropdown should be closed initially
    expect(within(header).queryByRole("listbox")).toBeNull();
  });

  it("opens the session dropdown when trigger is clicked", () => {
    render(<ChatPanel />);

    const listbox = openDropdown();
    expect(listbox).toBeTruthy();

    // Should show all sessions
    const options = within(listbox).getAllByRole("option");
    expect(options.length).toBe(2);

    // First session should be selected
    expect(options[0].getAttribute("aria-selected")).toBe("true");
    expect(options[0].textContent).toBe("Session 1");
  });

  it("shows delete buttons on each session row", () => {
    render(<ChatPanel />);

    const listbox = openDropdown();
    const deleteButtons = within(listbox).getAllByRole("button", { name: /Delete/ });
    expect(deleteButtons.length).toBe(2);
    expect(deleteButtons[0].getAttribute("aria-label")).toBe("Delete Session 1");
    expect(deleteButtons[1].getAttribute("aria-label")).toBe("Delete Homepage fix");
  });

  it("calls switchSession when a session row is clicked", () => {
    render(<ChatPanel />);

    const listbox = openDropdown();
    const options = within(listbox).getAllByRole("option");

    // Click the second session (Homepage fix)
    fireEvent.click(options[1]);

    expect(sessionActions.switchSession).toHaveBeenCalledWith("session-2");
  });

  it("calls deleteSession when a delete button is clicked (no switchSession fired)", () => {
    render(<ChatPanel />);

    const listbox = openDropdown();
    const deleteBtn = within(listbox).getByRole("button", { name: "Delete Homepage fix" });

    fireEvent.click(deleteBtn);

    expect(sessionActions.deleteSession).toHaveBeenCalledWith("session-2");
    expect(sessionActions.switchSession).not.toHaveBeenCalled();
  });

  it("calls createSession when the add button is clicked", () => {
    render(<ChatPanel />);

    const addBtn = screen.getByRole("button", { name: "Add new session" });

    fireEvent.click(addBtn);

    expect(sessionActions.createSession).toHaveBeenCalled();
  });

  it("disables the trigger when streaming is active", () => {
    mockSessionState.isStreaming = true;

    render(<ChatPanel />);

    const trigger = screen.getByRole("button", { name: /Current session:/ });
    expect(trigger).toBeTruthy();
    expect((trigger as HTMLButtonElement).disabled).toBe(true);

    // Click should not open dropdown
    fireEvent.click(trigger);
    expect(screen.queryByRole("listbox", { name: "Sessions" })).toBeNull();
  });

  it("disables delete buttons when only one session exists", () => {
    mockSessionState.availableSessions = [
      { id: "default", title: "Session 1", createdAt: 1, updatedAt: 1 },
    ];

    render(<ChatPanel />);

    const listbox = openDropdown();
    const deleteBtn = within(listbox).getByRole("button", { name: "Delete Session 1" });
    expect((deleteBtn as HTMLButtonElement).disabled).toBe(true);
  });
});

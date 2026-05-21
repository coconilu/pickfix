/**
 * Bridge script tests.
 *
 * These execute the injected IIFE against a tiny DOM double so the tests cover
 * the real event handlers, metadata building, highlight overlay, and
 * postMessage behavior without depending on a browser package.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BRIDGE_SCRIPT } from "@pickfix/bridge";

type Listener = (event: any) => void;

class FakeElement {
  tagName: string;
  parentElement: FakeElement | null = null;
  previousElementSibling: FakeElement | null = null;
  children: FakeElement[] = [];
  attributes = new Map<string, string>();
  style: Record<string, string> & { cssText: string } = { cssText: "" };
  id = "";
  className = "";
  textContent = "";
  outerHTML = "";
  isConnected = true;
  rect = { x: 0, y: 0, width: 100, height: 40 };
  computedStyle = {
    display: "block",
    visibility: "visible",
    opacity: "1",
    color: "rgb(17, 24, 39)",
    backgroundColor: "rgb(255, 255, 255)",
    fontSize: "16px",
    fontWeight: "400",
  };

  constructor(tagName: string) {
    this.tagName = tagName.toUpperCase();
    this.outerHTML = `<${tagName}></${tagName}>`;
  }

  appendChild(child: FakeElement) {
    const prev = this.children[this.children.length - 1] ?? null;
    child.previousElementSibling = prev;
    child.parentElement = this;
    child.isConnected = true;
    this.children.push(child);
    return child;
  }

  setAttribute(name: string, value: string) {
    this.attributes.set(name, value);
    if (name === "id") this.id = value;
    if (name === "class") this.className = value;
  }

  getAttribute(name: string) {
    if (name === "id" && this.id) return this.id;
    return this.attributes.get(name) ?? null;
  }

  hasAttribute(name: string) {
    return this.attributes.has(name);
  }

  toggleAttribute(name: string, force?: boolean) {
    const enabled = force ?? !this.attributes.has(name);
    if (enabled) this.attributes.set(name, "");
    else this.attributes.delete(name);
    return enabled;
  }

  getBoundingClientRect() {
    return this.rect;
  }
}

const HOST_ORIGIN = "http://localhost:3001";

function createBridgeHarness({ referrer = `${HOST_ORIGIN}/` } = {}) {
  const documentListeners = new Map<string, Listener[]>();
  const windowListeners = new Map<string, Listener[]>();
  const html = new FakeElement("html");
  const head = new FakeElement("head");
  const body = new FakeElement("body");
  html.appendChild(head);
  html.appendChild(body);

  const document = {
    documentElement: html,
    head,
    body,
    referrer,
    createElement: (tag: string) => new FakeElement(tag),
    addEventListener: (type: string, listener: Listener) => {
      documentListeners.set(type, [...(documentListeners.get(type) ?? []), listener]);
    },
  };

  const postMessage = vi.fn();
  const window = {
    parent: { postMessage },
    getComputedStyle: (el: FakeElement) => el.computedStyle,
    addEventListener: (type: string, listener: Listener) => {
      windowListeners.set(type, [...(windowListeners.get(type) ?? []), listener]);
    },
  };

  new Function("window", "document", BRIDGE_SCRIPT)(window, document);

  const dispatchDocument = (type: string, event: Record<string, unknown>) => {
    for (const listener of documentListeners.get(type) ?? []) listener(event);
  };
  const dispatchWindow = (type: string, event: Record<string, unknown>) => {
    for (const listener of windowListeners.get(type) ?? []) listener(event);
  };
  const enablePickMode = () => {
    dispatchWindow("message", { source: window.parent, origin: HOST_ORIGIN, data: { type: "od:pf-mode", enabled: true } });
  };

  return {
    document,
    window,
    html,
    body,
    postMessage,
    dispatchDocument,
    dispatchWindow,
    enablePickMode,
    createElement: (tag: string) => new FakeElement(tag),
  };
}

describe("bridge script", () => {
  it("exports a non-empty injected script with the expected protocol", () => {
    expect(BRIDGE_SCRIPT).toBeTypeOf("string");
    expect(BRIDGE_SCRIPT.length).toBeGreaterThan(500);
    expect(BRIDGE_SCRIPT).toContain("od:pf-mode");
    expect(BRIDGE_SCRIPT).toContain("od:pf-pick");
    expect(BRIDGE_SCRIPT).toContain("od:pf-hover");
  });

  it("installs pick-mode CSS when executed", () => {
    const h = createBridgeHarness();
    const style = h.document.head.children[0];
    expect(style.tagName).toBe("STYLE");
    expect(style.textContent).toContain("crosshair");
    expect(style.textContent).toContain("data-pf-mode");
  });
});

describe("pick mode", () => {
  it("toggles the data-pf-mode attribute from host messages", () => {
    const h = createBridgeHarness();

    h.dispatchWindow("message", { source: h.window.parent, origin: HOST_ORIGIN, data: { type: "od:pf-mode", enabled: true } });
    expect(h.html.hasAttribute("data-pf-mode")).toBe(true);

    h.dispatchWindow("message", { source: h.window.parent, origin: HOST_ORIGIN, data: { type: "od:pf-mode", enabled: false } });
    expect(h.html.hasAttribute("data-pf-mode")).toBe(false);
  });

  it("ignores pick-mode messages from a non-parent window", () => {
    const h = createBridgeHarness();

    h.dispatchWindow("message", { source: {}, origin: HOST_ORIGIN, data: { type: "od:pf-mode", enabled: true } });

    expect(h.html.hasAttribute("data-pf-mode")).toBe(false);
  });

  it("ignores pick-mode messages from a non-parent origin", () => {
    const h = createBridgeHarness();

    h.dispatchWindow("message", { origin: "https://evil.test", data: { type: "od:pf-mode", enabled: true } });

    expect(h.html.hasAttribute("data-pf-mode")).toBe(false);
  });

  it("ignores hover while pick mode is disabled", () => {
    const h = createBridgeHarness();
    const button = h.createElement("button");
    button.textContent = "Save";
    h.body.appendChild(button);

    h.dispatchDocument("mouseover", { target: button });

    expect(h.postMessage).not.toHaveBeenCalled();
  });
});

describe("hover behavior", () => {
  it("posts hover metadata and creates a highlight overlay", () => {
    const h = createBridgeHarness();
    const button = h.createElement("button");
    button.setAttribute("id", "save-button");
    button.setAttribute("class", "primary cta");
    button.textContent = " Save changes ";
    button.outerHTML = `<button id="save-button" class="primary cta">Save changes</button>`;
    button.rect = { x: 12.2, y: 20.8, width: 130.4, height: 44.2 };
    h.body.appendChild(button);
    h.enablePickMode();

    h.dispatchDocument("mouseover", { target: button });

    expect(h.postMessage).toHaveBeenCalledTimes(1);
    expect(h.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "od:pf-hover",
        elementId: "save-button",
        tag: "button",
        id: "save-button",
        classes: "primary cta",
        text: "Save changes",
        selector: "body > button:nth-of-type(1)",
        rect: { x: 12, y: 21, width: 130, height: 44 },
        style: expect.objectContaining({ fontSize: "16px" }),
      }),
      HOST_ORIGIN,
    );

    const overlay = h.body.children.find((child) => child.getAttribute("id") === "__pf-highlight-overlay");
    expect(overlay).toBeTruthy();
    expect(overlay?.style.display).toBe("block");
    expect(overlay?.style.left).toBe("12px");
    expect(overlay?.style.top).toBe("21px");
  });

  it("does not post for invisible targets", () => {
    const h = createBridgeHarness();
    const hidden = h.createElement("button");
    hidden.setAttribute("id", "hidden-button");
    hidden.textContent = "Hidden";
    hidden.computedStyle = { ...hidden.computedStyle, display: "none" };
    h.body.appendChild(hidden);
    h.enablePickMode();

    h.dispatchDocument("mouseover", { target: hidden });

    expect(h.postMessage).not.toHaveBeenCalled();
  });
});

describe("click behavior", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("prevents navigation and posts pick metadata", () => {
    const h = createBridgeHarness();
    const link = h.createElement("a");
    link.setAttribute("class", "nav-link");
    link.textContent = "Pricing";
    h.body.appendChild(h.createElement("a"));
    h.body.appendChild(link);
    h.enablePickMode();

    const preventDefault = vi.fn();
    const stopPropagation = vi.fn();
    h.dispatchDocument("click", { target: link, preventDefault, stopPropagation });

    expect(preventDefault).toHaveBeenCalledTimes(1);
    expect(stopPropagation).toHaveBeenCalledTimes(1);
    expect(h.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "od:pf-pick",
        elementId: "nav-link",
        tag: "a",
        selector: "body > a:nth-of-type(2)",
      }),
      HOST_ORIGIN,
    );
  });
});

describe("leave behavior", () => {
  it("posts leave and hides the overlay when the pointer leaves a target", () => {
    const h = createBridgeHarness();
    h.enablePickMode();

    h.dispatchDocument("mouseout", { target: null });

    expect(h.postMessage).toHaveBeenCalledWith({ type: "od:pf-leave" }, HOST_ORIGIN);
  });
});

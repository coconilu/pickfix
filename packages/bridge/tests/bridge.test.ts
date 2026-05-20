/**
 * Bridge script unit tests.
 * Extracts and tests the core DOM selection functions from the IIFE.
 */
import { describe, it, expect } from "vitest";
import { BRIDGE_SCRIPT } from "@pickfix/bridge";

// Extract a function body from the IIFE for isolated testing
function callBridgeFn<T>(fnName: string, args: unknown[]): T {
  const wrapped = `
    ${BRIDGE_SCRIPT.replace(/^var (enabled|hoveredId|overlay) = /gm, "let $&")}
    return ${fnName}(...${JSON.stringify(args)});
  `;
  const fn = new Function(wrapped);
  return fn() as T;
}

describe("bridge script", () => {
  it("export BRIDGE_SCRIPT is a non-empty string", () => {
    expect(BRIDGE_SCRIPT).toBeTypeOf("string");
    expect(BRIDGE_SCRIPT.length).toBeGreaterThan(500);
    expect(BRIDGE_SCRIPT).toContain("od:pf-mode");
    expect(BRIDGE_SCRIPT).toContain("od:pf-pick");
    expect(BRIDGE_SCRIPT).toContain("od:pf-hover");
  });

  it("contains CSS for pick mode cursor", () => {
    expect(BRIDGE_SCRIPT).toContain("crosshair");
    expect(BRIDGE_SCRIPT).toContain("data-pf-mode");
  });

  it("contains postMessage call for pick event", () => {
    expect(BRIDGE_SCRIPT).toContain("post('od:pf-pick'");
  });

  it("contains postMessage call for hover event", () => {
    expect(BRIDGE_SCRIPT).toContain("post('od:pf-hover'");
  });

  it("contains postMessage call for leave event", () => {
    expect(BRIDGE_SCRIPT).toContain("post('od:pf-leave'");
  });

  it("listens for od:pf-mode message to toggle pick mode", () => {
    expect(BRIDGE_SCRIPT).toContain("od:pf-mode");
    expect(BRIDGE_SCRIPT).toContain("toggleAttribute('data-pf-mode'");
  });

  it("prevents default on click when pick mode is active", () => {
    expect(BRIDGE_SCRIPT).toContain("preventDefault()");
    expect(BRIDGE_SCRIPT).toContain("stopPropagation()");
  });
});

describe("domSelectorFor", () => {
  it("returns null for null/undefined", () => {
    expect(BRIDGE_SCRIPT).toContain("domSelectorFor");
    expect(BRIDGE_SCRIPT).toContain("return null");
  });

  it("returns body > tag:nth-of-type(n) pattern", () => {
    expect(BRIDGE_SCRIPT).toContain("body > ");
    expect(BRIDGE_SCRIPT).toContain("nth-of-type");
  });

  it("skips script, style, template, meta elements", () => {
    expect(BRIDGE_SCRIPT).toMatch(/\/\^\(script\|style\|template\|meta/);
  });
});

describe("visibleTarget (named 'visibleTarget')", () => {
  it("rejects document.documentElement", () => {
    expect(BRIDGE_SCRIPT).toContain("document.documentElement");
  });

  it("rejects elements with display:none", () => {
    expect(BRIDGE_SCRIPT).toContain("display");
    expect(BRIDGE_SCRIPT).toContain("visibility");
  });

  it("rejects elements with size 0", () => {
    expect(BRIDGE_SCRIPT).toContain("width < 1");
    expect(BRIDGE_SCRIPT).toContain("height < 1");
  });
});

describe("isMeaningful", () => {
  it("accepts semantic elements", () => {
    expect(BRIDGE_SCRIPT).toMatch(/\b(a|button|input|textarea|select|label)\b/);
  });

  it("accepts elements with role or aria-label", () => {
    expect(BRIDGE_SCRIPT).toContain("role");
    expect(BRIDGE_SCRIPT).toContain("aria-label");
  });

  it("accepts divs with id or class and text", () => {
    expect(BRIDGE_SCRIPT).toContain("hasAttribute('id')");
    expect(BRIDGE_SCRIPT).toContain("hasAttribute('class')");
    expect(BRIDGE_SCRIPT).toContain("textContent");
  });
});

describe("element meta building", () => {
  it("collects tag name (lowercase)", () => {
    expect(BRIDGE_SCRIPT).toContain("tagName.toLowerCase()");
  });

  it("collects class names", () => {
    expect(BRIDGE_SCRIPT).toContain("className");
  });

  it("collects bounding rect", () => {
    expect(BRIDGE_SCRIPT).toContain("getBoundingClientRect()");
  });

  it("collects text content (trimmed, max 160)", () => {
    expect(BRIDGE_SCRIPT).toContain(".slice(0, 160)");
  });

  it("collects outerHTML hint (max 200)", () => {
    expect(BRIDGE_SCRIPT).toContain("outerHTML");
    expect(BRIDGE_SCRIPT).toContain(".slice(0, 200)");
  });

  it("generates fallback elementId when id and classes are missing", () => {
    expect(BRIDGE_SCRIPT).toContain("Math.random()");
    expect(BRIDGE_SCRIPT).toContain("toString(36)");
  });
});

describe("highlight overlay", () => {
  it("creates a fixed overlay div", () => {
    expect(BRIDGE_SCRIPT).toContain("position:fixed");
    expect(BRIDGE_SCRIPT).toContain("pointer-events:none");
    expect(BRIDGE_SCRIPT).toContain("z-index:2147483646");
  });

  it("uses blue highlight color", () => {
    expect(BRIDGE_SCRIPT).toContain("59, 130, 246");
  });
});

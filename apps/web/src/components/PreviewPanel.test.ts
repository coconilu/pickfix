import { describe, expect, it, vi } from "vitest";
import {
  applyBridgeMessageToPreviewState,
  elementMetaFromBridgeMessage,
  isTrustedBridgeMessageEvent,
  targetOriginForPreviewUrl,
} from "./PreviewPanel";
import type { BridgeMessage } from "@/lib/bridge-protocol";

const pickMessage: Extract<BridgeMessage, { type: "od:pf-pick" }> = {
  type: "od:pf-pick",
  elementId: "cta-button",
  tag: "button",
  id: "",
  classes: "cta primary",
  text: "Start now",
  rect: { x: 10, y: 20, width: 120, height: 40 },
  selector: "body > button:nth-of-type(1)",
  htmlHint: "<button>Start now</button>",
};

describe("PreviewPanel bridge message helpers", () => {
  it("derives a strict target origin from the preview URL", () => {
    expect(targetOriginForPreviewUrl("http://localhost:4000/path?q=1")).toBe(
      "http://localhost:4000",
    );
    expect(targetOriginForPreviewUrl("not a url")).toBe("");
  });

  it("accepts messages only from the current iframe window and preview origin", () => {
    const iframeWindow = {} as Window;

    expect(
      isTrustedBridgeMessageEvent({
        eventSource: iframeWindow,
        eventOrigin: "http://localhost:4000",
        iframeWindow,
        previewUrl: "http://localhost:4000",
      }),
    ).toBe(true);

    expect(
      isTrustedBridgeMessageEvent({
        eventSource: {} as Window,
        eventOrigin: "http://localhost:4000",
        iframeWindow,
        previewUrl: "http://localhost:4000",
      }),
    ).toBe(false);

    expect(
      isTrustedBridgeMessageEvent({
        eventSource: iframeWindow,
        eventOrigin: "https://evil.test",
        iframeWindow,
        previewUrl: "http://localhost:4000",
      }),
    ).toBe(false);
  });

  it("maps bridge payloads to ElementMeta", () => {
    expect(elementMetaFromBridgeMessage(pickMessage)).toEqual({
      elementId: "cta-button",
      tag: "button",
      id: "",
      classes: "cta primary",
      text: "Start now",
      rect: { x: 10, y: 20, width: 120, height: 40 },
      selector: "body > button:nth-of-type(1)",
      htmlHint: "<button>Start now</button>",
      style: null,
    });
  });

  it("updates active element on hover", () => {
    const actions = {
      setPickMode: vi.fn(),
      setActiveElement: vi.fn(),
      addPickedElement: vi.fn(),
    };

    applyBridgeMessageToPreviewState(
      { ...pickMessage, type: "od:pf-hover" },
      actions,
    );

    expect(actions.setActiveElement).toHaveBeenCalledWith(
      expect.objectContaining({ elementId: "cta-button" }),
    );
    expect(actions.addPickedElement).not.toHaveBeenCalled();
    expect(actions.setPickMode).not.toHaveBeenCalled();
  });

  it("adds picked element and exits pick mode on pick", () => {
    const actions = {
      setPickMode: vi.fn(),
      setActiveElement: vi.fn(),
      addPickedElement: vi.fn(),
    };

    applyBridgeMessageToPreviewState(pickMessage, actions);

    expect(actions.addPickedElement).toHaveBeenCalledWith(
      expect.objectContaining({ elementId: "cta-button" }),
    );
    expect(actions.setActiveElement).toHaveBeenCalledWith(
      expect.objectContaining({ elementId: "cta-button" }),
    );
    expect(actions.setPickMode).toHaveBeenCalledWith(false);
  });

  it("clears active element on leave", () => {
    const actions = {
      setPickMode: vi.fn(),
      setActiveElement: vi.fn(),
      addPickedElement: vi.fn(),
    };

    applyBridgeMessageToPreviewState({ type: "od:pf-leave" }, actions);

    expect(actions.setActiveElement).toHaveBeenCalledWith(null);
    expect(actions.addPickedElement).not.toHaveBeenCalled();
  });
});

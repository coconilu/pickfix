import { describe, expect, it, vi } from "vitest";
import {
  applyBridgeMessageToPreviewState,
  elementMetaFromBridgeMessage,
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

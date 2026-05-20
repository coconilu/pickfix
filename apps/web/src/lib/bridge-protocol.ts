/**
 * Type definitions for the postMessage protocol between
 * the PickFix web UI and the injected selection bridge.
 */

export interface ElementMeta {
  elementId: string;
  tag: string;
  id: string;
  classes: string;
  text: string;
  rect: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  selector: string;
  htmlHint: string;
  style: {
    color: string;
    backgroundColor: string;
    fontSize: string;
    fontWeight: string;
  } | null;
}

/** Host → Bridge: toggle pick mode */
export interface PfModeMessage {
  type: "od:pf-mode";
  enabled: boolean;
}

/** Bridge → Host: hover over element */
export interface PfHoverMessage {
  type: "od:pf-hover";
  elementId: string;
  tag: string;
  id: string;
  classes: string;
  text: string;
  rect: ElementMeta["rect"];
  selector: string;
  htmlHint: string;
}

/** Bridge → Host: element picked */
export interface PfPickMessage {
  type: "od:pf-pick";
  elementId: string;
  tag: string;
  id: string;
  classes: string;
  text: string;
  rect: ElementMeta["rect"];
  selector: string;
  htmlHint: string;
}

/** Bridge → Host: cursor left element */
export interface PfLeaveMessage {
  type: "od:pf-leave";
}

export type BridgeMessage = PfModeMessage | PfHoverMessage | PfPickMessage | PfLeaveMessage;

/**
 * Chat message type for the UI.
 */
export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  pickedElement?: ElementMeta | null;
}

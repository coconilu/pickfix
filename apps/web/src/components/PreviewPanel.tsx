"use client";

import { useRef, useEffect, useCallback, useState } from "react";
import { useSessionState, useSessionActions } from "@/providers/session";
import type { BridgeMessage, ElementMeta } from "@/lib/bridge-protocol";

export interface PreviewBridgeActions {
  setPickMode: (enabled: boolean) => void;
  setActiveElement: (el: ElementMeta | null) => void;
  addPickedElement: (el: ElementMeta) => void;
}

export function elementMetaFromBridgeMessage(
  data: Extract<BridgeMessage, { type: "od:pf-hover" | "od:pf-pick" }>,
): ElementMeta {
  return {
    elementId: data.elementId,
    tag: data.tag,
    id: data.id,
    classes: data.classes,
    text: data.text,
    rect: data.rect,
    selector: data.selector,
    htmlHint: data.htmlHint,
    style: null,
  };
}

export function applyBridgeMessageToPreviewState(
  data: BridgeMessage,
  actions: PreviewBridgeActions,
): void {
  switch (data.type) {
    case "od:pf-hover": {
      actions.setActiveElement(elementMetaFromBridgeMessage(data));
      break;
    }
    case "od:pf-pick": {
      const el = elementMetaFromBridgeMessage(data);
      actions.addPickedElement(el);
      actions.setActiveElement(el);
      actions.setPickMode(false);
      break;
    }
    case "od:pf-leave":
      actions.setActiveElement(null);
      break;
  }
}

export function PreviewPanel() {
  const { previewUrl, pickMode } = useSessionState();
  const { setPickMode, setActiveElement, addPickedElement, setPreviewUrl } =
    useSessionActions();

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const addressInputRef = useRef<HTMLInputElement>(null);
  const [iframeReady, setIframeReady] = useState(false);
  const [navigatingUrl, setNavigatingUrl] = useState(previewUrl);
  const [addressValue, setAddressValue] = useState(previewUrl);

  // Sync address bar when previewUrl changes externally
  useEffect(() => {
    setAddressValue(previewUrl);
    setNavigatingUrl(previewUrl);
  }, [previewUrl]);

  // Handle messages from the bridge inside the iframe
  const handleMessage = useCallback(
    (ev: MessageEvent) => {
      const data = ev.data as BridgeMessage | null;
      if (!data || typeof data.type !== "string") return;

      applyBridgeMessageToPreviewState(data, {
        setPickMode,
        setActiveElement,
        addPickedElement,
      });
    },
    [setActiveElement, addPickedElement, setPickMode],
  );

  useEffect(() => {
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [handleMessage]);

  // Send pick mode state to the iframe bridge
  useEffect(() => {
    if (!iframeReady) return;
    iframeRef.current?.contentWindow?.postMessage(
      { type: "od:pf-mode", enabled: pickMode },
      "*",
    );
  }, [pickMode, iframeReady]);

  const handleAddressKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      const url = addressValue.trim();
      if (!url) return;
      // Auto-prepend http:// if no protocol
      const normalized = /^https?:\/\//i.test(url) ? url : `http://${url}`;
      setNavigatingUrl(normalized);
      setPreviewUrl(normalized);
      setIframeReady(false);
      addressInputRef.current?.blur();
    } else if (e.key === "Escape") {
      setAddressValue(navigatingUrl);
      addressInputRef.current?.blur();
    }
  };

  const togglePickMode = () => {
    setPickMode(!pickMode);
  };

  return (
    <div className="preview-panel">
      <div className="preview-toolbar">
        <span className="preview-toolbar-title">Live Preview</span>
        <div className="preview-toolbar-actions">
          <button
            className={`preview-btn-pick ${pickMode ? "active" : ""}`}
            onClick={togglePickMode}
            title={
              pickMode
                ? "Exit pick mode (Esc)"
                : "Pick an element from the preview"
            }
          >
            {pickMode ? "✓ Picking" : "☝ Pick Element"}
          </button>
          <button
            className="preview-btn-reload"
            onClick={() => {
              const iframe = iframeRef.current;
              if (iframe) iframe.src = iframe.src;
            }}
            title="Reload preview"
          >
            ↻
          </button>
        </div>
      </div>
      <div className="preview-address-bar">
        <span className="preview-address-icon">🔗</span>
        <input
          ref={addressInputRef}
          className="preview-address-input"
          type="text"
          value={addressValue}
          onChange={(e) => setAddressValue(e.target.value)}
          onKeyDown={handleAddressKeyDown}
          onFocus={(e) => e.target.select()}
          placeholder="Enter URL and press Enter…"
          spellCheck={false}
        />
      </div>
      <div className="preview-iframe-wrapper">
        {!iframeReady && (
          <div className="preview-loading">
            <div className="preview-loading-spinner" />
            <p>Loading preview...</p>
          </div>
        )}
        <iframe
          ref={iframeRef}
          className="preview-iframe"
          src={navigatingUrl}
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
          onLoad={() => setIframeReady(true)}
          title="PickFix Preview"
        />
      </div>
    </div>
  );
}

"use client";

import { useRef, useEffect, useCallback, useState } from "react";
import { useSessionState, useSessionActions } from "@/providers/session";
import type { BridgeMessage, ElementMeta } from "@/lib/bridge-protocol";

export function PreviewPanel() {
  const { previewUrl, pickMode } = useSessionState();
  const { setPickMode, setActiveElement, addPickedElement } =
    useSessionActions();

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [iframeReady, setIframeReady] = useState(false);

  // Handle messages from the bridge inside the iframe
  const handleMessage = useCallback(
    (ev: MessageEvent) => {
      const data = ev.data as BridgeMessage | null;
      if (!data || typeof data.type !== "string") return;

      switch (data.type) {
        case "od:pf-hover": {
          const el: ElementMeta = {
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
          setActiveElement(el);
          break;
        }
        case "od:pf-pick": {
          const el: ElementMeta = {
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
          addPickedElement(el);
          setActiveElement(el);
          setPickMode(false);
          break;
        }
        case "od:pf-leave":
          setActiveElement(null);
          break;
      }
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
              iframeRef.current?.contentWindow?.location.reload();
            }}
            title="Reload preview"
          >
            ↻
          </button>
        </div>
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
          src={previewUrl}
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
          onLoad={() => setIframeReady(true)}
          title="PickFix Preview"
        />
      </div>
    </div>
  );
}

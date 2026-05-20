/**
 * Serves the PickFix selection bridge script at /__pf/bridge.js.
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import { BRIDGE_SCRIPT } from "@pickfix/bridge";

export function serveBridgeScript(
  _req: IncomingMessage,
  res: ServerResponse,
): void {
  res.writeHead(200, {
    "Content-Type": "application/javascript; charset=utf-8",
    "Cache-Control": "no-cache, no-store, must-revalidate",
    "Access-Control-Allow-Origin": "*",
  });
  res.end(BRIDGE_SCRIPT);
}

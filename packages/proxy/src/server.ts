/**
 * PickFix Preview Proxy Server
 *
 * Starts an HTTP + WebSocket reverse proxy that:
 *   1. Forwards all requests to the target dev server
 *   2. Injects the selection bridge script into text/html responses
 *   3. Proxies WebSocket connections for HMR support
 *   4. Serves the bridge script at /__pf/bridge.js
 *
 * Usage: tsx server.ts [--port 4000] [--target http://localhost:3000]
 */

import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import httpProxy from "http-proxy";
import { shouldInjectHtml, injectBridgeScript, passThrough } from "./html-inject.js";
import { handleWsUpgrade } from "./ws-proxy.js";
import { serveBridgeScript } from "./serve-bridge.js";

const PORT = parseInt(process.env.PF_PROXY_PORT ?? "4000", 10);
const TARGET_URL = process.env.PF_TARGET_URL ?? "http://localhost:3000";
const BRIDGE_PATH = "/__pf/bridge.js";

function parseTarget(url: string): { host: string; port: number } {
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: parseInt(parsed.port, 10) || 80,
  };
}

const target = parseTarget(TARGET_URL);

// Create the HTTP proxy
const proxy = httpProxy.createProxyServer({
  target: TARGET_URL,
  changeOrigin: true,
  ws: true,
  // Don't auto-handle errors — we handle them ourselves
});

proxy.on("error", (err, _req, res) => {
  console.error(`[pickfix-proxy] proxy error:`, err.message);
  if (res && "writeHead" in res) {
    const sr = res as ServerResponse;
    if (!sr.headersSent) {
      sr.writeHead(502, { "Content-Type": "text/plain" });
    }
    sr.end("Proxy error: " + err.message);
  }
});

const server = createServer((req: IncomingMessage, res: ServerResponse) => {
  // Route: serve the bridge script
  if (req.url === BRIDGE_PATH) {
    serveBridgeScript(req, res);
    return;
  }

  // Add CORS headers for preflight
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "*",
    });
    res.end();
    return;
  }

  // Proxy the request — intercept HTML to inject bridge
  proxy.web(req, res, {}, (err) => {
    console.error(`[pickfix-proxy] web proxy error:`, err.message);
    if (!res.headersSent) {
      res.writeHead(502, { "Content-Type": "text/plain" });
    }
    res.end("Bad Gateway: " + err.message);
  });
});

// Intercept proxy responses for HTML injection
proxy.on("proxyRes", (proxyRes: IncomingMessage, req: IncomingMessage, res: ServerResponse) => {
  // Don't intercept the bridge script itself
  if (req.url === BRIDGE_PATH) return;

  if (shouldInjectHtml(proxyRes, req)) {
    injectBridgeScript(proxyRes, req, res, { bridgePath: BRIDGE_PATH });
  } else {
    passThrough(proxyRes, req, res);
  }
});

// Handle WebSocket upgrade for HMR
server.on("upgrade", (req: IncomingMessage, socket, head) => {
  // Our own bridge route doesn't need WS
  if (req.url === BRIDGE_PATH) {
    socket.destroy();
    return;
  }

  // For Next.js HMR, the WS path is usually /_next/webpack-hmr
  // We handle it ourselves for better control
  handleWsUpgrade(req, socket, head, target);
});

server.listen(PORT, () => {
  console.log(`\n🔧 PickFix Preview Proxy`);
  console.log(`   Proxy:  http://localhost:${PORT}`);
  console.log(`   Target: ${TARGET_URL}`);
  console.log(`   Bridge: http://localhost:${PORT}${BRIDGE_PATH}`);
  console.log(`   HMR:    WebSocket proxying enabled\n`);
});

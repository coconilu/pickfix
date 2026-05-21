/**
 * PickFix Preview Proxy — Pure Node.js implementation.
 * Zero external dependencies. Handles HTTP proxying, HTML injection,
 * WebSocket upgrade, and bridge script serving.
 */
import { createServer, request as httpRequest, type IncomingMessage, type ServerResponse, type Server } from "node:http";
import type { Duplex } from "node:stream";
import { connect } from "node:net";
import { BRIDGE_SCRIPT } from "@pickfix/bridge";

export interface ProxyOptions {
  port: number;
  targetUrl: string;
  bridgePath?: string;
}

const STRIP_REQUEST_HEADERS = new Set([
  "host", "connection", "keep-alive", "transfer-encoding",
  "te", "trailer", "upgrade", "proxy-authorization",
  "proxy-authenticate", "accept-encoding",
]);

const STRIP_RESPONSE_HEADERS = new Set([
  "x-frame-options",
]);

function copyHeaders(
  source: IncomingMessage["headers"],
  target: Record<string, string | string[] | undefined>,
  strip: Set<string>,
): void {
  for (const [key, value] of Object.entries(source)) {
    if (strip.has(key.toLowerCase())) continue;
    if (key.toLowerCase() === "content-security-policy" && typeof value === "string") {
      const relaxed = value.replace(/frame-ancestors\s+[^;]+;?/gi, "frame-ancestors *;");
      target[key] = relaxed.includes("frame-ancestors") ? relaxed : value + "; frame-ancestors *";
      continue;
    }
    if (value !== undefined) target[key] = value;
  }
}

function insertBeforeClose(html: string, closeTag: string, injection: string): string {
  const escaped = closeTag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const idx = html.search(new RegExp(escaped, "i"));
  if (idx >= 0) return html.slice(0, idx) + injection + html.slice(idx);
  const bodyIdx = html.search(/<body[^>]*>/i);
  if (bodyIdx >= 0) return html.slice(0, bodyIdx) + injection + html.slice(bodyIdx);
  return injection + html;
}

export function createProxyServer(options: ProxyOptions): Server {
  const targetUrl = new URL(options.targetUrl);
  const TARGET_HOST = targetUrl.hostname;
  const TARGET_PORT = parseInt(targetUrl.port, 10) || 80;
  const BRIDGE_PATH = options.bridgePath ?? "/__pf/bridge.js";

  function proxyHttp(clientReq: IncomingMessage, clientRes: ServerResponse): void {
    const reqOpts = {
      hostname: TARGET_HOST,
      port: TARGET_PORT,
      path: clientReq.url ?? "/",
      method: clientReq.method ?? "GET",
      headers: {} as Record<string, string | string[] | undefined>,
    };
    copyHeaders(clientReq.headers, reqOpts.headers, STRIP_REQUEST_HEADERS);

    const proxyReq = httpRequest(reqOpts, (proxyRes) => {
      const statusCode = proxyRes.statusCode ?? 200;
      const resHeaders: Record<string, string | string[] | undefined> = {};
      copyHeaders(proxyRes.headers, resHeaders, STRIP_RESPONSE_HEADERS);
      const contentType = String(proxyRes.headers["content-type"] ?? "");

      if (contentType.includes("text/html")) {
        const chunks: Buffer[] = [];
        proxyRes.on("data", (c: Buffer) => chunks.push(c));
        proxyRes.on("end", () => {
          let body = Buffer.concat(chunks).toString("utf-8");
          body = insertBeforeClose(body, "</head>", `<script src="${BRIDGE_PATH}" data-pf-bridge></script>`);
          // Remove compression/ length headers since body was modified
          delete resHeaders["content-encoding"];
          delete resHeaders["content-length"];
          clientRes.writeHead(statusCode, resHeaders);
          clientRes.end(body);
        });
      } else {
        clientRes.writeHead(statusCode, resHeaders);
        proxyRes.pipe(clientRes);
      }
    });

    proxyReq.on("error", (err) => {
      console.error(`[pickfix-proxy] upstream error:`, err.message);
      if (!clientRes.headersSent) {
        clientRes.writeHead(502, { "Content-Type": "text/plain" });
      }
      clientRes.end("Bad Gateway: " + err.message);
    });

    clientReq.pipe(proxyReq);
  }

  function serveBridge(_req: IncomingMessage, res: ServerResponse): void {
    res.writeHead(200, {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "no-cache, no-store, must-revalidate",
      "Access-Control-Allow-Origin": "*",
    });
    res.end(BRIDGE_SCRIPT);
  }

  function proxyWebSocket(clientReq: IncomingMessage, clientSocket: Duplex, head: Buffer): void {
    const targetSocket = connect(TARGET_PORT, TARGET_HOST, () => {
      const lines = [`${clientReq.method ?? "GET"} ${clientReq.url ?? "/"} HTTP/1.1`];
      for (const [key, value] of Object.entries(clientReq.headers)) {
        const lower = key.toLowerCase();
        if (lower === "host" || lower === "connection" || lower === "upgrade") continue;
        if (value) lines.push(`${key}: ${Array.isArray(value) ? value.join(", ") : value}`);
      }
      lines.push(`Host: ${TARGET_HOST}:${TARGET_PORT}`);
      lines.push("Connection: Upgrade");
      lines.push(`Upgrade: ${String(clientReq.headers["upgrade"] ?? "websocket")}`);
      lines.push("", "");
      targetSocket.write(lines.join("\r\n"));
      if (head.length > 0) targetSocket.write(head);
    });

    targetSocket.on("error", (err) => {
      console.error(`[pickfix-ws] target error:`, err.message);
      clientSocket.destroy();
    });
    clientSocket.on("error", (err) => {
      console.error(`[pickfix-ws] client error:`, err.message);
      targetSocket.destroy();
    });
    targetSocket.on("close", () => clientSocket.destroy());
    clientSocket.on("close", () => targetSocket.destroy());
    targetSocket.pipe(clientSocket);
    clientSocket.pipe(targetSocket);
  }

  const server = createServer((req, res) => {
    if (req.url === BRIDGE_PATH) { serveBridge(req, res); return; }
    if (req.method === "OPTIONS") {
      res.writeHead(204, {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
        "Access-Control-Allow-Headers": "*",
      });
      res.end();
      return;
    }
    proxyHttp(req, res);
  });

  server.on("upgrade", (req, socket, head) => {
    if (req.url === BRIDGE_PATH) { socket.destroy(); return; }
    proxyWebSocket(req, socket, head);
  });

  return server;
}

// ---- CLI entry: auto-start when run directly ----
const isMain = process.argv[1]?.includes("server.ts") || process.argv[1]?.includes("server.js");
if (isMain) {
  const port = parseInt(process.env.PF_PROXY_PORT ?? "4000", 10);
  const target = process.env.PF_TARGET_URL ?? "http://localhost:3000";
  const server = createProxyServer({ port, targetUrl: target });
  server.listen(port, () => {
    console.log(`\n🔧 PickFix Preview Proxy`);
    console.log(`   Proxy:  http://localhost:${port}`);
    console.log(`   Target: ${target}`);
    console.log(`   Bridge: http://localhost:${port}/__pf/bridge.js`);
    console.log(`   HMR:    WebSocket proxying enabled\n`);
  });
}

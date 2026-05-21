/**
 * Proxy integration tests.
 * Uses createProxyServer() to start a proxy against a real HTTP target,
 * then verifies HTML injection, bridge serving, CSS pass-through, and headers.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createServer, request, type IncomingMessage, type ServerResponse, type Server } from "node:http";
import { connect } from "node:net";
import type { Socket } from "node:net";
import { createProxyServer } from "../src/server.js";
import { BRIDGE_SCRIPT } from "@pickfix/bridge";

const TARGET_PORT = 14003;
const PROXY_PORT = 14004;

let targetServer: Server;
let proxyServer: Server;

function readRequestBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks).toString()));
    req.on("error", reject);
  });
}

function fetchProxy(
  path = "/",
  options: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
  } = {},
): Promise<{ status: number; body: string; buffer: Buffer; headers: Record<string, string> }> {
  return new Promise((resolve, reject) => {
    const req = request(
      `http://localhost:${PROXY_PORT}${path}`,
      {
        method: options.method ?? "GET",
        headers: options.headers,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => {
          const headers: Record<string, string> = {};
          for (const [k, v] of Object.entries(res.headers)) {
            if (v) headers[k] = Array.isArray(v) ? v[0] : v;
          }
          const buffer = Buffer.concat(chunks);
          resolve({ status: res.statusCode ?? 0, body: buffer.toString(), buffer, headers });
        });
      },
    );
    req.on("error", reject);
    if (options.body) req.write(options.body);
    req.end();
  });
}

function countMatches(text: string, needle: string): number {
  return text.split(needle).length - 1;
}

function requestWebSocketThroughProxy(path: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const socket = connect(PROXY_PORT, "localhost");
    let received = "";
    let upgraded = false;
    const timeout = setTimeout(() => {
      socket.destroy();
      reject(new Error("timed out waiting for websocket proxy response"));
    }, 2_000);

    socket.on("connect", () => {
      socket.write([
        `GET ${path} HTTP/1.1`,
        `Host: localhost:${PROXY_PORT}`,
        "Connection: Upgrade",
        "Upgrade: websocket",
        "Sec-WebSocket-Key: test-key",
        "Sec-WebSocket-Version: 13",
        "",
        "",
      ].join("\r\n"));
    });
    socket.on("data", (chunk) => {
      received += chunk.toString("utf8");
      if (!upgraded && received.includes("\r\n\r\n")) {
        upgraded = true;
        socket.write("ping");
      }
      if (received.includes("echo:ping")) {
        clearTimeout(timeout);
        socket.end();
        resolve(received);
      }
    });
    socket.on("error", (err) => {
      clearTimeout(timeout);
      reject(err);
    });
    socket.on("close", () => clearTimeout(timeout));
  });
}

beforeAll(async () => {
  targetServer = createServer(async (_req: IncomingMessage, res: ServerResponse) => {
    const url = _req.url ?? "/";
    if (url === "/") {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end("<!doctype html><html><head><meta charset=utf-8></head><body><h1>Hello</h1></body></html>");
    } else if (url === "/style.css") {
      res.writeHead(200, { "Content-Type": "text/css" });
      res.end("body { color: red; }");
    } else if (url === "/with-csp") {
      res.writeHead(200, {
        "Content-Type": "text/html",
        "Content-Security-Policy": "default-src 'self'; frame-ancestors 'none'",
        "X-Frame-Options": "DENY",
      });
      res.end("<html><head></head><body>csp test</body></html>");
    } else if (url === "/with-csp-no-frame-ancestors") {
      res.writeHead(200, {
        "Content-Type": "text/html",
        "Content-Security-Policy": "default-src 'self'",
      });
      res.end("<html><head></head><body>csp append test</body></html>");
    } else if (url === "/with-encoded-length") {
      const body = "<html><head></head><body>encoded length test</body></html>";
      res.writeHead(200, {
        "Content-Type": "text/html",
        "Content-Encoding": "gzip",
        "Content-Length": String(Buffer.byteLength(body)),
      });
      res.end(body);
    } else if (url === "/no-head") {
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end("<html><body>no head tag</body></html>");
    } else if (url === "/already-injected") {
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end('<html><head><script src="/__pf/bridge.js" data-pf-bridge></script></head><body>already</body></html>');
    } else if (url === "/image.png") {
      const body = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x01, 0x02, 0x03]);
      res.writeHead(200, {
        "Content-Type": "image/png",
        "Content-Length": String(body.length),
      });
      res.end(body);
    } else if (url.startsWith("/echo")) {
      const body = await readRequestBody(_req);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        method: _req.method,
        url: _req.url,
        header: _req.headers["x-pickfix-test"],
        body,
      }));
    } else if (url === "/stream") {
      res.writeHead(200, { "Content-Type": "text/html" });
      res.write("<!doctype html><html><hea");
      setTimeout(() => { res.write("d><title>T</title></head><body>s</body></html>"); res.end(); }, 30);
    } else {
      res.writeHead(404);
      res.end("not found");
    }
  });

  targetServer.on("upgrade", (req: IncomingMessage, socket: Socket) => {
    if (req.url !== "/hmr") {
      socket.destroy();
      return;
    }
    socket.write([
      "HTTP/1.1 101 Switching Protocols",
      "Connection: Upgrade",
      "Upgrade: websocket",
      "",
      "",
    ].join("\r\n"));
    socket.on("data", (chunk) => socket.write(`echo:${chunk.toString("utf8")}`));
  });

  await new Promise<void>((r) => targetServer.listen(TARGET_PORT, r));

  proxyServer = createProxyServer({
    port: PROXY_PORT,
    targetUrl: `http://localhost:${TARGET_PORT}`,
  });
  await new Promise<void>((r) => proxyServer.listen(PROXY_PORT, r));
});

afterAll(() => {
  proxyServer?.close();
  targetServer?.close();
});

describe("proxy server", () => {
  it("returns 200 for HTML", async () => {
    const res = await fetchProxy("/");
    expect(res.status).toBe(200);
  });

  it("injects bridge script before </head>", async () => {
    const res = await fetchProxy("/");
    expect(res.body).toContain('<script src="/__pf/bridge.js"');
    expect(res.body).toContain("<h1>Hello</h1>");
  });

  it("does not inject a duplicate bridge script", async () => {
    const res = await fetchProxy("/already-injected");
    expect(res.status).toBe(200);
    expect(countMatches(res.body, "data-pf-bridge")).toBe(1);
  });

  it("injects bridge when no </head> tag (falls back to <body)", async () => {
    const res = await fetchProxy("/no-head");
    expect(res.body).toContain('<script src="/__pf/bridge.js"');
  });

  it("serves bridge script at /__pf/bridge.js", async () => {
    const res = await fetchProxy("/__pf/bridge.js");
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("javascript");
    expect(res.body).toBe(BRIDGE_SCRIPT);
  });

  it("passes through CSS unchanged", async () => {
    const res = await fetchProxy("/style.css");
    expect(res.status).toBe(200);
    expect(res.body).toBe("body { color: red; }");
  });

  it("passes through binary assets unchanged", async () => {
    const res = await fetchProxy("/image.png");
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toBe("image/png");
    expect([...res.buffer]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x01, 0x02, 0x03]);
  });

  it("forwards method, path, query, headers, and request body", async () => {
    const res = await fetchProxy("/echo?source=proxy", {
      method: "POST",
      headers: {
        "Content-Type": "text/plain",
        "X-PickFix-Test": "forwarded",
      },
      body: "hello upstream",
    });

    expect(res.status).toBe(200);
    expect(JSON.parse(res.body)).toEqual({
      method: "POST",
      url: "/echo?source=proxy",
      header: "forwarded",
      body: "hello upstream",
    });
  });

  it("strips X-Frame-Options header", async () => {
    const res = await fetchProxy("/with-csp");
    expect(res.headers["x-frame-options"]).toBeUndefined();
  });

  it("relaxes frame-ancestors in CSP", async () => {
    const res = await fetchProxy("/with-csp");
    const csp = res.headers["content-security-policy"] ?? "";
    expect(csp).not.toMatch(/frame-ancestors\s+'none'/);
    expect(csp).toContain("frame-ancestors *");
  });

  it("adds frame-ancestors to CSP when the directive is missing", async () => {
    const res = await fetchProxy("/with-csp-no-frame-ancestors");
    const csp = res.headers["content-security-policy"] ?? "";
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("frame-ancestors *");
  });

  it("removes stale encoding and length headers after HTML injection", async () => {
    const res = await fetchProxy("/with-encoded-length");
    expect(res.body).toContain('<script src="/__pf/bridge.js"');
    expect(res.headers["content-encoding"]).toBeUndefined();
    expect(res.headers["content-length"]).toBeUndefined();
  });

  it("handles CORS OPTIONS preflight", () => {
    return new Promise((resolve) => {
      const req = request({ hostname: "localhost", port: PROXY_PORT, path: "/", method: "OPTIONS" }, (res) => {
        expect(res.statusCode).toBe(204);
        expect(res.headers["access-control-allow-origin"]).toBe("*");
        resolve(undefined);
      });
      req.end();
    });
  });

  it("returns 404 from target", async () => {
    const res = await fetchProxy("/nonexistent");
    expect(res.status).toBe(404);
  });

  it("handles streamed HTML injection", async () => {
    const res = await fetchProxy("/stream");
    expect(res.body).toContain('<script src="/__pf/bridge.js"');
  });

  it("returns 502 when the upstream target is unavailable", async () => {
    const brokenProxy = createProxyServer({
      port: 14006,
      targetUrl: "http://localhost:14999",
    });
    await new Promise<void>((r) => brokenProxy.listen(14006, r));
    try {
      const res = await new Promise<{ status: number; body: string }>((resolve, reject) => {
        const req = request("http://localhost:14006/", (response) => {
          const chunks: Buffer[] = [];
          response.on("data", (c) => chunks.push(c));
          response.on("end", () => {
            resolve({ status: response.statusCode ?? 0, body: Buffer.concat(chunks).toString() });
          });
        });
        req.on("error", reject);
        req.end();
      });

      expect(res.status).toBe(502);
      expect(res.body).toContain("Bad Gateway");
    } finally {
      await new Promise<void>((r) => brokenProxy.close(() => r()));
    }
  });

  it("proxies WebSocket upgrade traffic", async () => {
    const response = await requestWebSocketThroughProxy("/hmr");
    expect(response).toContain("HTTP/1.1 101 Switching Protocols");
    expect(response).toContain("echo:ping");
  });
});

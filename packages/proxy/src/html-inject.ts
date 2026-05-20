/**
 * HTML injection middleware for the preview proxy.
 * Intercepts text/html responses and injects the selection bridge script.
 */
import type { IncomingMessage, ServerResponse } from "node:http";

export interface InjectOptions {
  bridgePath: string;
}

/**
 * Returns true if the response should be intercepted for bridge injection.
 */
export function shouldInjectHtml(
  proxyRes: IncomingMessage,
  _req: IncomingMessage,
): boolean {
  const contentType = proxyRes.headers["content-type"] ?? "";
  return typeof contentType === "string" && contentType.includes("text/html");
}

/**
 * Injects the bridge <script> tag before </head> in the HTML response.
 * Handles chunked transfer encoding by buffering until </head> is found,
 * injecting the script, then streaming the rest.
 */
export function injectBridgeScript(
  proxyRes: IncomingMessage,
  _req: IncomingMessage,
  res: ServerResponse,
  options: InjectOptions,
): void {
  // Remove headers that prevent iframe embedding
  removeFrameBlockingHeaders(proxyRes, res);

  const chunks: Buffer[] = [];
  let injected = false;

  proxyRes.on("data", (chunk: Buffer) => {
    if (injected) {
      res.write(chunk);
      return;
    }
    chunks.push(chunk);
    const combined = Buffer.concat(chunks).toString("utf-8");

    // Try to find </head> or <body to inject before
    const headEndIdx = combined.search(/<\/head>/i);
    const bodyStartIdx = combined.search(/<body[^>]*>/i);

    if (headEndIdx >= 0) {
      injected = true;
      const injection = `<script src="${options.bridgePath}" data-pf-bridge></script>`;
      const before = combined.slice(0, headEndIdx);
      const after = combined.slice(headEndIdx);
      res.write(before + injection + after);
    } else if (bodyStartIdx >= 0) {
      injected = true;
      const injection = `<script src="${options.bridgePath}" data-pf-bridge></script>`;
      const before = combined.slice(0, bodyStartIdx);
      const after = combined.slice(bodyStartIdx);
      res.write(before + injection + after);
    }
    // Otherwise keep buffering - wait for </head> or <body
  });

  proxyRes.on("end", () => {
    if (!injected) {
      // No </head> or <body found — inject at the beginning
      const combined = Buffer.concat(chunks).toString("utf-8");
      const injection = `<script src="${options.bridgePath}" data-pf-bridge></script>`;
      res.write(injection + combined);
    }
    res.end();
  });
}

/**
 * Pass through non-HTML responses unchanged.
 */
export function passThrough(
  proxyRes: IncomingMessage,
  _req: IncomingMessage,
  res: ServerResponse,
): void {
  removeFrameBlockingHeaders(proxyRes, res);
  proxyRes.pipe(res);
}

/**
 * Removes or relaxes headers that would prevent the page from being
 * displayed in an iframe.
 */
function removeFrameBlockingHeaders(
  proxyRes: IncomingMessage,
  res: ServerResponse,
): void {
  // Copy all headers except frame-blocking ones
  for (const [key, value] of Object.entries(proxyRes.headers)) {
    const lower = key.toLowerCase();
    if (lower === "x-frame-options") continue;
    if (lower === "content-security-policy" && typeof value === "string") {
      // Remove frame-ancestors restriction
      const relaxed = value.replace(
        /frame-ancestors\s+[^;]+;?/gi,
        "frame-ancestors *;",
      );
      if (!relaxed.includes("frame-ancestors")) {
        res.setHeader(key, value + "; frame-ancestors *");
      } else {
        res.setHeader(key, relaxed);
      }
      continue;
    }
    if (value !== undefined) {
      res.setHeader(key, value);
    }
  }
}

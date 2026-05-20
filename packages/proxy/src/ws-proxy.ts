/**
 * WebSocket proxy for HMR support.
 * Proxies WebSocket upgrade requests from the iframe to the target dev server.
 */
import type { IncomingMessage } from "node:http";
import type { Socket } from "node:net";
import { connect } from "node:net";

export interface WsProxyOptions {
  targetHost: string;
  targetPort: number;
}

/**
 * Handle a WebSocket upgrade request by creating a bidirectional pipe
 * between the client and the target dev server.
 */
export function handleWsUpgrade(
  req: IncomingMessage,
  socket: Socket,
  head: Buffer,
  options: WsProxyOptions,
): void {
  const targetSocket = connect(options.targetPort, options.targetHost, () => {
    // Forward the upgrade request headers
    const headers = [
      `${req.method ?? "GET"} ${req.url ?? "/"} HTTP/1.1`,
      `Host: ${options.targetHost}:${options.targetPort}`,
    ];
    for (const [key, value] of Object.entries(req.headers)) {
      if (key.toLowerCase() === "host") continue;
      if (value) headers.push(`${key}: ${Array.isArray(value) ? value.join(", ") : value}`);
    }
    headers.push("", ""); // End of headers
    targetSocket.write(headers.join("\r\n"));

    if (head.length > 0) {
      targetSocket.write(head);
    }
  });

  targetSocket.on("error", (err) => {
    console.error(`[pickfix-ws] target error:`, err.message);
    socket.destroy();
  });

  socket.on("error", (err) => {
    console.error(`[pickfix-ws] client error:`, err.message);
    targetSocket.destroy();
  });

  targetSocket.on("close", () => socket.destroy());
  socket.on("close", () => targetSocket.destroy());

  // Bidirectional pipe
  targetSocket.pipe(socket);
  socket.pipe(targetSocket);
}

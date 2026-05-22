import { createHash } from "node:crypto";
import { realpath } from "node:fs/promises";
import path from "node:path";

export const runtime = "nodejs";

export async function GET(): Promise<Response> {
  const configuredProjectRoot = process.env.PICKFIX_PROJECT_ROOT || process.env.PF_AGENT_CWD || process.cwd();
  const root = await realpath(configuredProjectRoot).catch(() => configuredProjectRoot);
  const name = path.basename(root) || root;
  const key = createHash("sha256").update(root).digest("hex").slice(0, 16);

  return Response.json({ root, name, key });
}

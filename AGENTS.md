# AGENTS.md — PickFix

## Quick reference

```bash
# Install
pnpm install

# Start everything (target → proxy → web, in order)
pnpm dev                             # uses CLI with examples/demo as external target
pnpm pickfix -- --project ../my-app --dev 'pnpm dev' --port 5678

# Run a single service (upstream must already be running)
PORT=5678 pnpm --filter @pickfix/example-demo dev  # official external project example
PF_TARGET_URL=http://localhost:5678 pnpm --filter @pickfix/proxy dev  # port 4000
pnpm --filter @pickfix/web dev                      # port 3001 (needs :4000)

# Typecheck all packages
pnpm typecheck   # alias for pnpm -r typecheck

# Run tests + typecheck (full validation)
pnpm check

# Run tests
pnpm test        # bridge + proxy + web
# Or single package:
pnpm --filter @pickfix/bridge test
pnpm --filter @pickfix/proxy test
```

## Architecture

```
browser → web UI (Next.js 16, :3001)
            ├── ChatPanel    ← AI SDK v4 (streamText + @ai-sdk/openai)
            ├── PreviewPanel  → iframe → proxy (:4000) → target app (:5678)
            └── StatusPanel

proxy interceptor (:4000) — pure Node.js, zero deps:
  - proxies HTTP to target, injects <script src="/__pf/bridge.js"> into text/html
  - strips X-Frame-Options, relaxes CSP frame-ancestors → *
  - proxies WebSocket for HMR
  - serves /__pf/bridge.js from @pickfix/bridge source

bridge (packages/bridge) — pure JS IIFE, exported as a string constant:
  - injected into iframe, no framework deps
  - postMessage protocol: od:pf-mode (toggle), od:pf-hover, od:pf-pick, od:pf-leave
  - element metadata includes tag, classes, id, rect, selector, htmlHint, inline styles
```

## Service startup order

The three services have a dependency chain. The root `pnpm dev` script uses `@pickfix/cli` to start the target project, wait for it, then start proxy and web. By default it treats `examples/demo` as the official external project example:

1. `PORT=5678 pnpm --filter @pickfix/example-demo dev` (target project, port 5678)
2. `PF_TARGET_URL=http://localhost:5678 pnpm --filter @pickfix/proxy dev` (port 4000 — needs :5678 responding)
3. `pnpm --filter @pickfix/web dev` (port 3001 — needs :4000 responding)

The proxy needs the target app already serving before it starts.

## Monorepo layout

```
packages/
  cli/        @pickfix/cli       — starts external project, proxy, and web with env wiring
  bridge/     @pickfix/bridge    — IIFE string export, no deps, vitest tests
  proxy/      @pickfix/proxy     — HTTP/WS proxy, depends on bridge (workspace:*)
apps/
  web/        @pickfix/web       — Next.js 16 + React 18 App Router, AI SDK v4
examples/
  demo/       @pickfix/example-demo  — official external project example
```

## Environment

- **Required**: Node `~24`, pnpm `10.33.2` (declared in `packageManager`)
- **Agent**: export `OPENAI_API_KEY` to enable AI agent; without it the agent shows a fallback message
- `@pickfix/web` Next config has `allowedDevOrigins: ["192.168.3.182"]` — if accessing from another LAN IP, add it here

## Testing

- Root `pnpm test` runs bridge, proxy, and web tests.
- **Vitest** with no config file — uses defaults. Run from package directory or via `--filter`.
- **Bridge tests** (`packages/bridge/tests/bridge.test.ts`): string-matching on the IIFE export. They assert the `BRIDGE_SCRIPT` string contains expected substrings, not DOM simulation. Use `callBridgeFn()` helper if you need to actually invoke a function from the IIFE.
- **Proxy tests** (`packages/proxy/tests/proxy.test.ts`): spin up real HTTP servers on ports 14003 (target) and 14004 (proxy). Tests verify HTML injection, bridge serving, CSP/CORS header manipulation, and streamed response handling.
- **Web tests** (`apps/web/src/**/*.test.ts`): cover session state and key PreviewPanel/ChatPanel behavior.

## TypeScript

- All packages extend `tsconfig.base.json` (ES2022 target, ESNext module, `bundler` resolution, strict mode)
- `bridge` and `proxy` use `"type": "module"` in package.json
- Next.js apps (`web`, `demo`) add `jsx: react-jsx`, DOM libs, and `@/*` path alias → `./src/*`
- No build step for bridge/proxy — `proxy` runs via `tsx`, `bridge` is imported as source

## Dependencies / API versions

- **AI SDK v4** (`ai` ^4.1.0, `@ai-sdk/openai` ^1.1.0) — use `streamText`, not `generateText` or v3 APIs
- **Next.js 16** with React 18 (not React 19)
- **No UI component library** — components use plain CSS (globals.css + inline styles)
- Proxy has zero external dependencies (pure node:http/node:net)

## Conventions

- Bridge → Host postMessage types all use the `od:pf-` prefix
- Bridge is a single `BRIDGE_SCRIPT` string constant — never split into separate exports
- The proxy injects the bridge `<script>` before `</head>` (falls back to before `<body>` if no `</head>`)
- Agent prompt format uses ` ```file:path/to/file ` fenced code blocks for file changes
- `pnpm predev` kills any lingering processes on ports 5678/4000/3001 and cleans `.next` dirs

## What doesn't exist yet

- No CI/CD workflows
- No build/compile step for bridge or proxy
- No linting or formatting config
- Branch management (git worktree), diff preview, source annotation (Phase 2+) are not implemented
- Web app has no tests

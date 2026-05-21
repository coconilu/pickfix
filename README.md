# PickFix

> Point, pick, fix — preview-driven development with AI

PickFix is an open-source development tool that lets you **click elements on a live preview** of your web app, describe what you want to change, and have an AI agent surgically modify your source code — with instant hot reload.

```
┌──────────────┬────────────────────┬──────────────┐
│  Agent Chat  │   Live Preview    │   Branch     │
│              │   (click to pick) │   Status     │
│  ┌────────┐  │  ┌──────────────┐ │  main        │
│  │ picked │  │  │              │ │  ├── 3 files │
│  │ button │  │  │   iframe     │ │  changed    │
│  │        │  │  │              │ │              │
│  ├────────┤  │  │              │ │  diff view   │
│  │ prompt │  │  └──────────────┘ │              │
│  └────────┘  │                  │              │
└──────────────┴────────────────────┴──────────────┘
```

## Status

🚧 **MVP (v0.1.0)** — Core element picking + agent chat flow working. Branch management and source annotation coming in Phase 2.

## Architecture

```
browser → web UI (Next.js :3001)
              ├── Chat Panel  ←─ agent (AI SDK)
              ├── Preview Panel (iframe :4000)  ←→  bridge (postMessage)
              └── Status Panel

iframe → proxy (:4000) → external target app (:5678 by default)
              │
              ├── HTML interception → inject bridge script
              ├── WebSocket proxy → HMR
              └── /__pf/bridge.js
```

## Quick Start

```bash
# 1. Install dependencies
pnpm install

# 2. Start PickFix with the official demo as an external target
pnpm dev
# → http://localhost:3001
```

To connect a separate project instead of the demo:

```bash
pnpm pickfix -- --project ../my-app --dev 'pnpm dev' --port 5678
```

Open **http://localhost:3001** and you'll see the three-panel layout:
- **Left**: Agent chat — send prompts and see AI responses
- **Center**: Live preview — click **"☝ Pick Element"** then click elements in the page
- **Right**: Branch status — shows changed files and diffs

### Using the Agent

Set `OPENAI_API_KEY` in your environment to enable the AI agent:

```bash
export OPENAI_API_KEY="sk-..."
```

Without it, the agent shows a fallback message explaining what it would do.

## How It Works

### Element Picking Flow

1. User clicks **"☝ Pick Element"** in the preview toolbar
2. The web UI sends `{ type: 'od:pf-mode', enabled: true }` to the iframe
3. The injected **selection bridge** activates: cursor becomes crosshair
4. User hovers elements → blue highlight overlay appears
5. User clicks an element → bridge captures:
   - Tag name, classes, ID
   - Text content
   - DOM selector path
   - Bounding rectangle
   - HTML hint
6. Bridge posts element metadata back to the web UI via `postMessage`
7. Element card appears in the chat panel
8. User types a change request ("make this button green")
9. Both the element context and user message are sent to the AI agent
10. Agent suggests code changes, which HMR applies automatically

### Bridge Injection

The proxy intercepts `text/html` responses from the target dev server and injects a `<script src="/__pf/bridge.js">` before `</head>`. The bridge runs as a self-contained IIFE inside the iframe — no framework dependencies, no user code changes required.

## Project Structure

```
pickfix/
├── packages/
│   ├── cli/          # Starts external project → proxy → web
│   ├── bridge/       # Selection bridge script (injected into iframe)
│   └── proxy/        # Reverse proxy with HTML injection + WS support
├── apps/
│   └── web/          # Three-panel UI (Next.js 16 + React 18)
└── examples/
    └── demo/         # Official external-project example
```

See [`PROJECT_STRUCTURE.md`](./PROJECT_STRUCTURE.md) for the external-project model and minimal-intrusion notes.

## Roadmap

- [x] MVP: Element picking + agent chat
- [x] Reverse proxy with HTML injection
- [x] WebSocket proxy for HMR
- [ ] Phase 2: Source annotation (data-od-source via SWC/Babel plugin)
- [ ] Phase 2: Git worktree integration
- [ ] Phase 2: Inspect panel (live CSS tweaks)
- [ ] Phase 3: Framework adapters (Nuxt, SvelteKit, Vite)
- [ ] Phase 3: Diff preview and commit integration

## License

MIT

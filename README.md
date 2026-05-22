# PickFix

> Point, pick, fix — preview-driven development with AI.

PickFix is a local development tool for making UI changes by clicking directly on a live preview. Open your app inside PickFix, pick an element, describe the change you want, and let an AI coding agent modify the real source files in your project. You can then inspect the diff, keep iterating, or roll back a file from the Changes panel.

```txt
┌──────────────┬────────────────────┬──────────────┐
│  Agent Chat  │   Live Preview     │   Changes    │
│              │   (click to pick)  │              │
│  ┌────────┐  │  ┌──────────────┐  │  main        │
│  │ picked │  │  │              │  │  ├── 3 files │
│  │ button │  │  │   iframe     │  │  changed     │
│  │        │  │  │              │  │              │
│  ├────────┤  │  │              │  │  diff view   │
│  │ prompt │  │  └──────────────┘  │  revert      │
│  └────────┘  │                    │              │
└──────────────┴────────────────────┴──────────────┘
```

## Why PickFix exists

Modern AI coding tools are good at editing code, but UI work often starts with a visual problem:

- “This button should be more prominent.”
- “Make this card less cramped.”
- “Change this title copy.”
- “The thing I mean is right here on the page.”

The problem is that the agent usually does not know what “this” means. You have to translate the visual target into file paths, component names, selectors, and implementation hints.

PickFix tries to close that gap. The live preview becomes the context picker: click the UI element, send its DOM metadata to the agent, and let the agent trace that visual target back to the source code.

## Inspiration

PickFix is inspired by the workflow of browser inspectors, visual website builders, and AI coding agents:

- From browser DevTools: inspect the exact thing on the page.
- From visual editors: make changes from the preview, not only from files.
- From AI coding agents: let the machine do the source-code surgery.

The goal is not to replace your editor or Git workflow. The goal is to make the first step of a UI change feel natural: point at the thing, say what you want, review the code.

## What it can do today

- Run an external target app without adding code to that app.
- Proxy the target app and inject a lightweight element-picking bridge.
- Pick elements from the preview and send metadata to the agent.
- Chat with a local Claude Code agent to modify source files.
- Show changed files and diffs for the target project.
- Revert individual changed files from the Changes panel.
- Persist chat history per target project across page refreshes.

PickFix is still an MVP. It is best suited for local experimentation and small UI edits.

## Screenshots

### Three-panel workspace

![PickFix workspace](./docs/images/workspace.png)

The full PickFix UI showing Agent Chat, Live Preview, and Changes.

### Picking an element

![Picking an element](./docs/images/pick-element.png)

Pick mode highlights the exact element in the proxied live preview.

### Reviewing and reverting changes

![Reviewing changes](./docs/images/changes-panel.png)

The Changes panel shows a diff preview and asks for confirmation before discarding a file's local edits.

## How it works

```txt
browser → PickFix web UI (:3001)
            ├── Agent Chat
            ├── Preview iframe → PickFix proxy (:4000) → target app (:5678)
            └── Changes panel → git status/diff for target project

proxy → intercepts HTML → injects /__pf/bridge.js
bridge → runs inside iframe → sends picked element metadata via postMessage
agent → runs in target project cwd → edits real source files
```

The target project does not need a PickFix dependency. PickFix starts your dev server, proxies it, injects a small browser bridge at runtime, and runs the agent with the target project as its working directory.

## Requirements

- Node `~24`
- pnpm `10.33.2`
- Git available on your machine
- Claude Code CLI available as `claude` for agent edits

Check Claude Code availability:

```bash
claude --version
```

If your binary is not named `claude`, set:

```bash
export CLAUDE_BIN=/path/to/claude
```

Optional model selection:

```bash
export PF_CLAUDE_MODEL=sonnet
```

## Local setup

Install dependencies first. This installs the PickFix packages and both bundled demo apps under `examples/`:

```bash
pnpm install
```

Run the default Next.js example target:

```bash
pnpm dev
```

Open:

```txt
http://localhost:3001
```

Run the Nuxt example target:

```bash
pnpm dev:nuxt
```

If you want to try PickFix against a separate local project instead of the bundled demos, install that project's dependencies first too:

```bash
cd /absolute/path/to/your-app
pnpm install
```

## Try the basic flow

1. Open `http://localhost:3001`.
2. In the Preview panel, enable pick mode.
3. Click an element in the page.
4. In Agent Chat, ask for a small change, for example:

   ```txt
   Make this title friendlier and slightly larger.
   ```

5. Wait for the agent response.
6. Watch the preview hot reload.
7. Review changed files in the Changes panel.
8. If needed, click the revert button next to a file to roll it back.

## Use PickFix with your own project

From the PickFix repo, run:

```bash
pnpm pickfix -- --project /absolute/path/to/your-app --dev 'pnpm dev --port 5678' --port 5678
```

The `--dev` command should start your app on the same port that you pass to `--port`. For example:

Nuxt:

```bash
pnpm pickfix -- --project /Users/me/projects/my-nuxt-app --dev 'pnpm dev --port 5678' --port 5678
```

Next.js:

```bash
pnpm pickfix -- --project /Users/me/projects/my-next-app --dev 'pnpm exec next dev -p 5678' --port 5678
```

PickFix will start three processes in order:

1. Your target app on the port you pass with `--port`.
2. PickFix proxy on `4000`.
3. PickFix web UI on `3001`.

Then open:

```txt
http://localhost:3001
```

### If your dev server is already running

Use `--no-dev` and point PickFix at the existing target URL:

```bash
pnpm pickfix -- --project /absolute/path/to/your-app --target http://localhost:5173 --no-dev
```

### Custom ports

```bash
pnpm pickfix -- \
  --project /absolute/path/to/your-app \
  --dev 'pnpm dev --port 5678' \
  --port 5678 \
  --proxy-port 4100 \
  --web-port 3100
```

## Development commands

```bash
# Typecheck all packages
pnpm typecheck

# Run tests
pnpm test

# Full validation
pnpm check

# Run only web tests
pnpm --filter @pickfix/web test
```

## Monorepo structure

```txt
pickfix/
├── apps/
│   └── web/          # Next.js UI: chat, preview, changes panel
├── packages/
│   ├── bridge/       # Injected element-picking bridge
│   ├── cli/          # Starts target → proxy → web
│   └── proxy/        # HTTP/WS proxy and bridge injection
└── examples/
    ├── next-demo/    # Example external Next.js app
    └── nuxt-demo/    # Example external Nuxt app
```

## Current limitations

- The agent quality depends on the selected element metadata and the clarity of your prompt.
- PickFix currently focuses on local development, not remote deployments.
- The Changes panel uses Git status/diff, so the target project should be inside a Git repository for the best experience.
- Branch/worktree management and source annotation are planned but not implemented yet.

## Roadmap

- [x] Live preview through proxy
- [x] Runtime bridge injection
- [x] Element picking
- [x] Agent chat
- [x] Changes panel with diff preview
- [x] Per-file revert from Changes
- [x] Per-project chat history
- [ ] Source annotation for better component/file mapping
- [ ] Branch/worktree workflow
- [ ] Commit/PR flow
- [ ] More framework adapters and examples

## License

MIT

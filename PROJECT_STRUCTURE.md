# PickFix Project Structure

PickFix is designed as a tool that connects to an external web project. The external project does not need to live inside this repository.

## Recommended usage model

```bash
pnpm pickfix -- --project ../my-app --dev 'pnpm dev' --port 5678
```

Meaning:

- `--project ../my-app`: path to the external project root.
- `--dev 'pnpm dev'`: command PickFix runs inside that project.
- `--port 5678`: expected target dev server port. PickFix also passes `PORT=5678` to the dev command.

PickFix then starts services in this order:

```txt
external target app (:5678)
  ↑
PickFix proxy (:4000)
  ↑ iframe
PickFix web UI (:3001)
```

The browser opens the PickFix web UI. The preview iframe points at the proxy, and the proxy forwards to the external target app while injecting the bridge script.

## Repository layout

```txt
pickfix/
  apps/
    web/              # PickFix web UI: chat, preview iframe, status panel

  packages/
    cli/              # pickfix command: starts target → proxy → web
    bridge/           # injected iframe bridge script, exported as BRIDGE_SCRIPT
    proxy/            # HTTP/WebSocket preview proxy and bridge injector

  examples/
    demo/             # official external-project example only

  PROJECT_STRUCTURE.md
  AGENTS.md
  package.json
  pnpm-workspace.yaml
```

## Role of `examples/`

`examples/demo` is not a required location for user projects. It is an official example target app used for development, demos, and regression checks.

Real users should keep their projects outside this repository:

```txt
workspace/
  pickfix/
  my-app/
```

Then run:

```bash
cd pickfix
pnpm pickfix -- --project ../my-app --dev 'pnpm dev' --port 5678
```

## Intrusion model

Default external-project connection is zero-intrusion:

- no source code changes required in the external project
- no PickFix SDK required in the external project
- no dependency installation required in the external project
- bridge injection happens at proxy time, not by editing target source files

The only change made in this repository is to the official demo app:

```txt
examples/demo/package.json
  "dev": "next dev"
```

This lets the CLI control the demo port with `PORT=5678`. This is a demo convenience, not a requirement for arbitrary user projects. If a user project cannot respect `PORT`, they can still point PickFix at an already-running server with `--target` or choose a matching `--port`.

## CLI options

```bash
pickfix --project <dir> --dev <command> --port <port>
pickfix --project <dir> --target http://localhost:3000 --no-dev
```

Supported options:

- `--project <dir>`: external project root.
- `--dev <command>`: command to start the external project.
- `--port <port>`: target app port; also passed as `PORT` to the dev process.
- `--target <url>`: explicit target URL. Useful when the external app is already running or does not use `PORT`.
- When both `--target` and `--port` are provided, `--target` controls the URL PickFix waits for; `--port` is still passed as `PORT` to the dev process.
- `--proxy-port <port>`: PickFix proxy port, default `4000`.
- `--web-port <port>`: PickFix web UI port, default `3001`.
- `--no-dev`: do not start the external project; wait for `--target` to be reachable.

## Development commands

```bash
pnpm dev
```

Runs the official demo as if it were an external project:

```bash
pnpm pickfix -- --project examples/demo --dev 'pnpm dev' --port 5678
```

Manual service startup is still possible:

```bash
PORT=5678 pnpm --filter @pickfix/example-demo dev
PF_TARGET_URL=http://localhost:5678 pnpm --filter @pickfix/proxy dev
pnpm --filter @pickfix/web dev
```

## Current boundaries

- `packages/cli` only orchestrates local processes and environment variables.
- `packages/proxy` injects the bridge and forwards HTTP/WebSocket traffic.
- `packages/bridge` collects element metadata and sends it to the host UI via `postMessage`.
- `apps/web` displays the preview/chat UI.

Future project analysis, patch application, git diff, and rollback logic should live in a separate core package instead of coupling directly to `examples/demo`.

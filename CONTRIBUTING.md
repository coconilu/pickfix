# Contributing

Thanks for helping improve PickFix. This project is maintained through focused issues and small pull requests.

## Development setup

```bash
pnpm install
pnpm dev
```

Open `http://localhost:3001` after the services start.

## Useful commands

```bash
# Start with the bundled Next.js demo
pnpm dev

# Start with the bundled Nuxt demo
pnpm dev:nuxt

# Typecheck all packages
pnpm typecheck

# Run tests
pnpm test

# Full validation
pnpm check
```

## Issue workflow

1. Open an issue before starting non-trivial work.
2. Use the right template: bug, feature request, or RFC/proposal.
3. Keep the scope small enough to review.
4. For larger changes, discuss the RFC first, then split implementation into smaller issues.
5. Link pull requests back to the issue they resolve.

## Pull request guidelines

- Keep each PR focused on one problem.
- Include tests when behavior changes.
- Update docs when commands, workflows, or user-facing behavior change.
- Include screenshots or recordings for visible UI changes.
- Run the relevant validation before requesting review.

## Project areas

- `apps/web` — Next.js UI for chat, preview, and changes.
- `packages/bridge` — injected browser bridge for element picking.
- `packages/proxy` — HTTP/WS proxy and bridge injection.
- `packages/cli` — local process orchestration for target, proxy, and web.
- `examples` — bundled external target apps used for demos and testing.

## Labels

Recommended issue labels:

- `type: bug`, `type: feature`, `type: rfc`, `type: docs`, `type: chore`
- `area: web`, `area: bridge`, `area: proxy`, `area: cli`, `area: examples`
- `priority: high`, `priority: medium`, `priority: low`
- `status: needs triage`, `status: needs discussion`, `status: ready`, `status: blocked`
- `good first issue`

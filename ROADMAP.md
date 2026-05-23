# Roadmap

This roadmap is intentionally lightweight. Use issues for active planning and pull requests for implementation details.

## Phase 1 — Core preview loop

- [x] Run an external target app from the PickFix CLI.
- [x] Proxy the target app through PickFix.
- [x] Inject the runtime bridge into proxied HTML.
- [x] Pick elements from the live preview.
- [x] Send element metadata to the agent chat.

## Phase 2 — Safer editing workflow

- [x] Show changed files and diff previews.
- [x] Revert individual changed files.
- [x] Persist chat history per target project.
- [ ] Improve source annotation for component/file mapping.
- [ ] Provide Next.js and Nuxt plugins for richer element-to-source context.
- [ ] Add branch or worktree isolation for agent edits.
- [ ] Add commit and PR flow.

## Phase 3 — Framework support

- [x] Next.js demo target.
- [x] Nuxt demo target.
- [ ] Vite demo target.
- [ ] Astro demo target.
- [ ] Document framework-specific setup notes.

## Phase 4 — Collaboration workflow

- [ ] Keep feature planning in GitHub Issues.
- [ ] Use RFC issues for larger design changes.
- [ ] Add GitHub Actions for typecheck, tests, and end-to-end validation on main/PR updates.
- [ ] Add contributor-friendly tasks with `good first issue`.
- [ ] Maintain release notes or changelog once the project is no longer MVP-only.

## Phase 5 — Enterprise deployment

- [ ] Support Docker-based deployment.
- [ ] Define a safe production-page UI tuning workflow for product managers and designers.
- [ ] Add deployment documentation for enterprise/self-hosted usage.

## Candidate RFCs

- Source annotation and component/file mapping.
- Next.js and Nuxt plugin strategy for mapping picked elements back to source files.
- Git branch/worktree strategy for safe agent edits.
- Commit/PR generation from accepted changes.
- Multi-framework adapter strategy.
- Docker deployment and enterprise production-editing workflow.
- GitHub Actions CI and end-to-end testing strategy.

# Adaptation record — novelmaker-webapp

This repository is the working home for re-imagining Novelmaker as a
**single-user, self-hosted web application**. It is a fork of
`maniesoft/Novelmaker-public` (AGPL-3.0), based on upstream commit
`9e8e78589c0bbcabbc41891197033214a7bbeb6a`. Upstream `main` is tracked and
merged deliberately; the tree currently includes upstream through `a939656`
("Localize remaining hardcoded UI strings and export headings", merged
2026-11-17).

## Remotes

- `origin` — this repository.
- `upstream` — `maniesoft/Novelmaker-public`, read-only; pulled only when
  deliberately syncing with upstream.

## Settled scope

- **Single-user, self-hosted.** No multi-user, no accounts, no teams.
- Browser UI served by the app itself from the container.
- Access hardening comes later and in front of the UI: IP allowlisting and a
  password gate. Not implemented yet.
- Keep upstream's local-first data model (one SQLite database, one library).

## Local delta from upstream

### Containerisation

- `Dockerfile` — multi-stage build from this repo's own source (not a pinned
  upstream clone), with the single-process launch command required for clean
  SIGTERM shutdown.
- `compose.yaml` — single-service stack with a configurable host port, data path,
  timezone and build context.
- `.dockerignore`, `.env.example` — build-context hygiene and non-secret runtime
  values.
- `CONTAINER.md` — build, deployment, backup and exposure runbook.
- `README.md` and the translated READMEs — fork banner and a container-deployment
  section; the English README also corrects the upstream "not in scope" line for
  single-user, self-hosted use.

### Application changes

- **Reasoning effort** — every generation path defaults to
  `reasoning_effort: "max"` (`server/src/services/generate.ts`), and derived token
  budgets include reasoning headroom (`server/src/services/jobs.ts`) so prose is
  not cut off mid-scene; `server/test/api.test.ts` asserts both.

The hidden-note fix (translated header via `data-label`, node view with a
hover-only delete control) was a fork delta until upstream adopted it verbatim
in `92e2bc1`; it is now upstream code and no longer part of our delta.

### Upstream syncs

- `ad3aaf9` — merge of upstream `a939656`: localized export headings, novel-cover
  and prompts-page strings, and the matching locale keys and tests. This sync
  also brought in `92e2bc1`, upstream's adoption of our hidden-note fix
  (identical blobs for `shared/src/doc.ts`, `web/src/editor/NoteView.tsx`,
  `web/src/editor/extensions.ts`, `web/src/index.css` and the regression test),
  so that delta is retired.
- `6037329` — merge of upstream `750c183`: undici-based LLM client without
  headers/body timeouts for long local-model runs, clearer network-error
  messages, and the matching locale strings.

The application code is otherwise upstream's, with the changes above applied on
top.

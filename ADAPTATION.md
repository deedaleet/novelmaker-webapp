# Adaptation record — novelmaker-webapp

This repository is the working home for re-imagining Novelmaker as a
**single-user, self-hosted web application**. It is a fork of
`maniesoft/Novelmaker-public` (AGPL-3.0), based on upstream commit
`9e8e78589c0bbcabbc41891197033214a7bbeb6a`.

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

Containerisation only — no application code changes yet:

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

The application code is otherwise identical to the upstream base commit above.

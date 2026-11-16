# Running Novelmaker as a container

This is the container build and deployment guide for `novelmaker-webapp`. It
builds the app from this repository's own source. The application remains a
single-user, self-hosted web app; there is no multi-user support.

## Quick start

```bash
cp .env.example .env          # set port, data path, timezone
docker compose up -d --build
```

Then open `http://<host>:<NOVELMAKER_HTTP_PORT>` (default 3002) and configure an
OpenAI-compatible provider in **Settings → AI providers**.

The first build is the slow one: it installs dependencies, builds the React SPA
and compiles/fetches the `better-sqlite3` native module. Later rebuilds reuse
cached layers.

## Deployment notes

- `compose.yaml` is the stack definition. Run compose from this repository's
  root, or set `NOVELMAKER_BUILD_CONTEXT` to a checkout path if your compose
  tooling keeps the stack file somewhere else.
- Build with `docker compose build`. A pull is a no-op for a build-from-source
  stack; if your compose UI separates Build and Update actions, use Build.
- No pre-start `chown` is required: the image runs as root, deliberately, so a
  bind-mounted data directory does not hit the non-root ownership trap.
- The data directory is created automatically if it does not exist; make sure
  its parent is on a filesystem with room for the library and its backups.

## Environment variables

| Variable | Default | Purpose |
|---|---|---|
| `NOVELMAKER_HTTP_PORT` | `3002` | Host port published for the UI/API |
| `NOVELMAKER_APPDATA` | `./data` | Host path bound to `/data` |
| `NOVELMAKER_BUILD_CONTEXT` | `.` | Build context; a checkout path when compose files live apart from the source |
| `TZ` | `America/Los_Angeles` | Container timezone |

There are **no secrets in `.env`**. Provider API keys are entered in the app UI
and stored in `/data/novelmaker.db` in plaintext. That volume is therefore both
the data and the credential surface.

## Inference

Novelmaker has no model of its own. In the app, add an OpenAI-compatible provider
pointing at the gateway or model server you use:

- Base URL: an OpenAI-compatible endpoint (for a gateway on the Docker host,
  `http://host.docker.internal:4000/v1`).
- API key: a dedicated key for this app, so usage is attributable and revocable.

`extra_hosts: host.docker.internal:host-gateway` in the compose is what makes
that hostname resolve from inside the container on Linux.

## Data, backups and shutdown

- `/data` holds `novelmaker.db`, `config.json` and `/data/backups/`.
- The app writes its own `VACUUM INTO` snapshots into `/data/backups/`, pruned to
  the configured count, plus a backup on quit and before destructive actions.
  It only starts doing so once the database contains at least one novel.
- Independent of that, the host path should be covered by the host's backup
  system.
- `docker stop` sends SIGTERM to the single node process, which writes a backup
  and releases the database lock. The image uses `init: true` and a 60-second
  stop grace period so that shutdown path can finish. Prefer `docker stop` over
  `docker kill`.

## Exposure and auth

The app has no login system. As shipped, it runs unauthenticated: the published
port binds all host interfaces, so it is reachable wherever that port is. Anyone
who can reach it gets full read/write access to the library and provider
settings.

The intended hardening, not yet implemented, is **single-user** access control in
front of the UI: IP allowlisting and a password gate. No multi-user accounts.

## Runtime notes / known limitations

- The launch command is `node --import tsx server/src/index.ts`, not `npm start`
  or the `tsx` CLI: those spawn a wrapper process that does not forward SIGTERM
  as PID 1, so `docker stop` would time out and skip the shutdown backup.
- `xdg-utils` is installed as a crash guard. The "show folder" action spawns
  `xdg-open` with no error handler; a missing binary kills the server. In a
  container the action opens nothing, which is harmless.
- The folder picker is Windows-only: `/api/system/browse` returns HTTP 501 on
  Linux. The UI falls back to typing a path, so no remote desktop is involved.
- `NOVELMAKER_OPEN` is deliberately unset — it shells out to a browser opener at
  startup.

## Verification performed

Verified against this container setup (2026-11-16):

- Image builds clean; container starts healthy and serves on the published port.
- `GET /` returns 200 with `<title>Novelmaker</title>`; `/api/settings`,
  `/api/novels`, `/api/providers` return 200; no authentication on any route.
- A real chat generation through an OpenAI-compatible gateway succeeded
  end-to-end (streamed SSE, logged token counts).
- `docker stop` produced the app's shutdown backup and released the lock; the
  container restarted healthy.
- Upstream test suite: 116 tests / 9 files pass.

## Updating

```bash
git pull
docker compose build
docker compose up -d
```

The image is built locally and has no registry digest, so automated
image-update tooling will skip it — rebuilds are deliberate, not automatic.

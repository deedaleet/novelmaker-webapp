# Running Novelmaker as a container

This is the canonical container build and deployment runbook for the
`novelmaker-webapp` fork. It builds the app from this repository's own source.
The application itself remains a single-user, self-hosted web app; there is no
multi-user support.

## Quick start (any Docker host)

```bash
cp .env.example .env          # set port, data path, timezone
docker compose up -d --build
```

Then open `http://<host>:<NOVELMAKER_HTTP_PORT>` (default 3002) and configure an
OpenAI-compatible provider in **Settings → AI providers**.

The first build is the slow one: it installs dependencies, builds the React SPA
and compiles/fetches the `better-sqlite3` native module. Later rebuilds reuse
cached layers.

## Unraid / Compose Manager

The live deployment is a Compose Manager project on deusnas:

- **Project directory:** `/boot/config/plugins/compose.manager/projects/novelmaker/`
- The build context is separate from appdata: keep a checkout of this repo as
  `src/` inside the project directory and set `NOVELMAKER_BUILD_CONTEXT=./src` in
  `.env`. The live deusnas deployment uses
  `/boot/config/plugins/compose.manager/projects/novelmaker/src`, a read-only
  deploy-key clone of the Forgejo repo. Appdata stays purely for runtime data.
- Project metadata: `name=Novelmaker`, `project_name=novelmaker`,
  `autostart=true`, `has_build=1`, and an `icon_url` pointing at a publicly
  fetchable image.
- **Build with `docker compose build`** from the project directory. The Compose
  Manager UI button runs `compose pull --ignore-buildable`, which is an instant
  no-op for a build-from-source stack — it does not build the image.
- On Unraid set `NOVELMAKER_APPDATA=/mnt/user/appdata/novelmaker` in `.env`.
- The default host port 3002 avoids 3000, which the GluetunVPN stack already
  holds on deusnas.

Pre-start, once:

```bash
mkdir -p /mnt/user/appdata/novelmaker
```

No `chown` is needed: the image runs as root, deliberately, so the bind mount
does not hit the non-root ownership trap.

## Environment variables

| Variable | Default | Purpose |
|---|---|---|
| `NOVELMAKER_HTTP_PORT` | `3002` | Host port published for the UI/API |
| `NOVELMAKER_APPDATA` | `./data` | Host path bound to `/data` |
| `NOVELMAKER_BUILD_CONTEXT` | `.` | Build context; `./src` on the deusnas deployment (a checkout inside the Compose project directory) |
| `TZ` | `America/Los_Angeles` | Container timezone |

There are **no secrets in `.env`**. Provider API keys are entered in the app UI
and stored in `/data/novelmaker.db` in plaintext. That volume is therefore both
the data and the credential surface.

## Inference

Novelmaker has no model of its own. In the app, add an OpenAI-compatible provider
pointing at the LiteLLM gateway on the Docker host:

- Base URL: `http://host.docker.internal:4000/v1`
- API key: a dedicated LiteLLM virtual key, so usage is attributable and
  revocable.

`extra_hosts: host.docker.internal:host-gateway` in the compose is what makes
that hostname resolve from inside the container.

## Data, backups and shutdown

- `/data` holds `novelmaker.db`, `config.json` and `/data/backups/`.
- The app writes its own `VACUUM INTO` snapshots into `/data/backups/`, pruned to
  the configured count, plus a backup on quit and before destructive actions.
  It only starts doing so once the database contains at least one novel.
- Independent of that, the host path should be covered by the host's backup
  system. On deusnas, Backrest already covers `/mnt/cache/appdata`.
- `docker stop` sends SIGTERM to the single node process, which writes a backup
  and releases the database lock. The image uses `init: true` and a 60-second
  stop grace period so that shutdown path can finish. Prefer `docker stop` over
  `docker kill`.

## Exposure and auth

The app has no login system. Phase 1 deliberately runs it unauthenticated, with
no SSO or reverse-proxy rule in front: the published port binds all host
interfaces and is kept off the WAN by policy alone. Anyone who can reach the port
gets full read/write access to the library and provider settings.

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

Verified against this container setup on deusnas (2026-11-15):

- Image builds clean; container starts healthy on `0.0.0.0:3002→3000`.
- `GET /` returns 200 with `<title>Novelmaker</title>`; `/api/settings`,
  `/api/novels`, `/api/providers` return 200; no authentication on any route.
- A real chat generation through LiteLLM succeeded end-to-end (streamed SSE,
  logged token counts).
- `docker stop` produced the app's shutdown backup and released the lock; the
  container restarted healthy.
- Upstream test suite: 115 tests / 9 files pass.
- **Live deployment source:** the deusnas Compose project builds from
  `/boot/config/plugins/compose.manager/projects/novelmaker/src`, a read-only
  deploy-key clone of the Forgejo repo, via `NOVELMAKER_BUILD_CONTEXT=./src`. It
  was rebuilt and recreated from that source on 2026-11-15; the image is
  byte-identical to the earlier pinned-upstream build because the application
  code has not changed yet.

## Updating

```bash
git -C /boot/config/plugins/compose.manager/projects/novelmaker/src pull
cd /boot/config/plugins/compose.manager/projects/novelmaker
docker compose build
docker compose up -d
```

`git pull` happens in the `src/` checkout inside the project directory, not in
appdata. Merge upstream deliberately when you want upstream changes; the working
repo is on Forgejo.

The image is built locally and has no registry digest, so the host's automated
image-update tooling will skip it — rebuilds are deliberate, not automatic.

# Development

Everything you need to run, test and maintain the code. The folder layout is in the [architecture guide](README.md) and the decisions in [`adr/`](adr/).

## Running locally

Prerequisites: Node 26.9+, pnpm 12.9.1 (`npm install -g pnpm@12.9.1`) and Docker.

```bash
# 1. LiveKit in dev mode (the key must be 32+ characters; the app validates this)
docker run -d --name lk-dev \
  -p 7880:7880 -p 7881:7881 -p 7882:7882/udp \
  livekit/livekit-server:v1.13.9 \
  --dev --bind 0.0.0.0 --node-ip 127.0.0.1 \
  --keys "devkey: devsecret-0123456789abcdef0123456789abcdef"

# 2. Local Postgres (same configuration and roles as production)
pnpm db:bootstrap:dev        # docker compose -f docker-compose.dev.yml up -d --wait

# 3. Variables
cp .env.example .env.local
#   LIVEKIT_API_KEY=devkey
#   LIVEKIT_API_SECRET=devsecret-0123456789abcdef0123456789abcdef
#   LIVEKIT_URL=ws://localhost:7880
#   DATABASE_URL=postgres://nelcota_app:app-dev@127.0.0.1:54329/nelcota
#   MIGRATOR_DATABASE_URL=postgres://nelcota_migrator:migrator-dev@127.0.0.1:54329/nelcota
#   TEST_DATABASE_URL=postgres://nelcota:nelcota-dev@127.0.0.1:54329/nelcota_test

# 4. App
pnpm install
pnpm db:migrate     # migrations with the migration user
pnpm db:seed        # optional: sample participants (password from SEED_PASSWORD, or a random one it prints), rooms and audit entries
pnpm dev            # http://127.0.0.1:3111
```

Open two tabs (or a private window), join the same room and share your screen.

## Scripts

| Script                                     | What it does                                                                         |
| ------------------------------------------ | ------------------------------------------------------------------------------------ |
| `pnpm dev` / `pnpm build` / `pnpm start`   | Development, production build and local production server                            |
| `pnpm typecheck`                           | `react-router typegen && tsc --noEmit` (route types, then native TypeScript 7)       |
| `pnpm lint` / `pnpm lint:fix`              | Full Oxlint with type information, and safe fixes                                    |
| `pnpm lint:fast` / `pnpm lint:fast:fix`    | Oxlint syntactic rules, without the type engine                                      |
| `pnpm lint:config`                         | Shows the configuration actually loaded by Oxlint                                    |
| `pnpm format`                              | Oxfmt (`.oxfmtrc.json`)                                                              |
| `pnpm format:check`                        | Checks the project's formatting without changing files                               |
| `pnpm test`                                | Vitest: unit + integration (the latter only with `TEST_DATABASE_URL`)                |
| `pnpm test:unit` / `pnpm test:integration` | Only one of the Vitest projects                                                      |
| `pnpm test:watch` / `pnpm test:coverage`   | Watch mode / coverage (`coverage/`, with a ratcheted minimum)                        |
| `pnpm test:e2e`                            | Playwright: room, panel and account flows (dev Postgres and LiveKit running)         |
| `pnpm knip`                                | Unused files, exports and dependencies                                               |
| `pnpm dup`                                 | Code duplication (jscpd, threshold in `.jscpd.json`)                                 |
| `pnpm db:bootstrap:dev`                    | Starts the local Postgres (`docker-compose.dev.yml`) with the roles                  |
| `pnpm db:generate`                         | Generates the SQL migration in `drizzle/` from `server/db/schema/`                   |
| `pnpm db:migrate`                          | Applies the migrations with `MIGRATOR_DATABASE_URL`                                  |
| `pnpm db:studio`                           | Opens Drizzle Studio                                                                 |
| `pnpm db:seed`                             | Sample data (local database only). `--profile=load --rows=300000` to test under load |
| `pnpm build:migrate`                       | Bundles the migrator into `dist/migrate.mjs` (used in the Docker image)              |
| `pnpm build:scripts`                       | Migrator, `create-owner.mjs` (runs in the image) and seed                            |

## Environment variables

| Variable                     | Required   | Description                                                                                                                                                       |
| ---------------------------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `LIVEKIT_API_KEY`            | yes        | LiveKit API key (same as the LiveKit server)                                                                                                                      |
| `LIVEKIT_API_SECRET`         | yes        | Secret (32+ characters). **Never** sent to the browser                                                                                                            |
| `LIVEKIT_URL`                | yes        | `wss://lk.yourdomain.com`                                                                                                                                         |
| `ACCESS_PASSWORD`            | no         | If set (8+ characters), everyone needs it to join (constant-time comparison; 5 wrong attempts per IP every 15 min)                                                |
| `MAX_PARTICIPANTS`           | no         | Per-room limit, from 2 to 8 (default 6)                                                                                                                           |
| `REQUIRE_EMAIL_VERIFICATION` | no         | `true` requires confirming the e-mail before joining rooms (default `false`, off for now)                                                                         |
| `TRUSTED_PROXY_HOPS`         | no         | Trusted proxies in front of the app, 1 to 5 (default 1, Coolify's Traefik; 2 behind the Cloudflare proxy). Decides which `X-Forwarded-For` IP the rate limit uses |
| `DATABASE_URL`               | yes        | Postgres (`postgres://…`), `nelcota_app` role                                                                                                                     |
| `MIGRATOR_DATABASE_URL`      | migrations | `nelcota_migrator` role, read by `pnpm db:migrate`. In production it lives only in the CI secrets, never in the app                                               |
| `AUTH_SECRET`                | yes        | Secret for participant accounts (32+ characters)                                                                                                                  |
| `ADMIN_AUTH_SECRET`          | no         | Enables `/admin` (32+ characters, `openssl rand -base64 48`). Requires the database                                                                               |
| `APP_URL`                    | production | Public origin of the app (e-mail links; required with the panel enabled)                                                                                          |
| `RESEND_API_KEY`             | no         | Enables Resend delivery over HTTPS with `MAIL_FROM`. Use a sending-only key scoped to the verified sender domain; leave `SMTP_URL` unset                          |
| `SMTP_URL`                   | no         | Alternative to Resend. Set with `MAIL_FROM` and leave `RESEND_API_KEY` unset                                                                                      |
| `MAIL_FROM`                  | with mail  | Sender, e.g. `Nelcota <no-reply@yourdomain.com>`. Production requires a provider and sender when verification is enabled; without delivery, dev logs the content  |
| `SENTRY_DSN`                 | no         | Enables Sentry on the server (no personal data)                                                                                                                   |
| `PUBLIC_SENTRY_DSN`          | no         | Enables browser error capture; loaded at runtime, no rebuild needed                                                                                               |
| `SENTRY_ISSUES_URL`          | no         | Sentry issues page (e.g. `https://org.sentry.io/issues/?project=123`); the panel links each recent error there by its request id                                  |
| `KLIPY_API_KEY`              | no         | Enables GIFs in messages. Public by design: the browser calls KLIPY directly. Without it, the GIF button is hidden                                                |
| `LOG_LEVEL`                  | no         | Log level (default `info` in production, `debug` in dev)                                                                                                          |
| `APP_VERSION`                | no         | Set by the image (commit SHA); shown in `/api/ready` and in Sentry                                                                                                |
| `TEST_DATABASE_URL`          | tests      | **Disposable** database for integration tests; Vitest recreates databases from it. Not read by the app                                                            |

The app's variables are validated with Zod in `server/env.server.ts`. If something is missing, the container exits with code 1 at boot and lists the problem in the logs.

`LIVEKIT_URL` is read at runtime by the server and returned to the browser along with the token. So changing the URL doesn't require a rebuild, and no variable needs to exist at build time.

## In-memory state (single instance)

Some state lives in the Node process, not in Postgres. It holds for a single replica (the Coolify default); running more than one needs a shared store such as Redis first.

- **Rate limits** (`server/rate-limit.server.ts`).
- **Presence** (`features/friends/server/online-presence.server.ts`): who sent a beat in the last 2 minutes.
- **Live updates** (`features/live/server/live-bus.server.ts`): the open `GET /api/eventos` streams (SSE), by account. Actions nudge only the accounts involved after the commit, and the browser reloads its loaders. The stream skips compression (`text/event-stream`, `no-transform`) and asks proxies not to buffer it (`X-Accel-Buffering: no`).

## Tests

- `tests/unit`: no database (pure domain: token decision, mascot rules, room protocol…).
- `tests/integration`: real Postgres. With `TEST_DATABASE_URL` (a **disposable** database; in dev it is read from `.env.local`), Vitest recreates an already-migrated template database and each test file gets a clean copy (`CREATE DATABASE … TEMPLATE`). Without the variable, it warns that only the unit tests will run. One of the tests runs as `nelcota_app` to check the grants.
- `tests/e2e`: Playwright with dev Postgres and LiveKit running. It starts the app on `127.0.0.1:3100` with its own database (`nelcota_e2e`, recreated on every run) and Chromium with a fake microphone and screen. If the port is taken, set `E2E_PORT` in the environment before running the tests. Install the browser once with `pnpm exec playwright install chromium`.

## Formatting

The formatting rules for AI agents are in [`AGENTS.md`](../AGENTS.md); CI also runs `pnpm format:check`.

## Oxlint

`oxlint.config.ts` is the main configuration, compatible with the installed Oxlint 1.87.
It covers `app`, `components` (including `components/ui`), `features`, `lib`, `server`, tests
and configuration files. Build output, dependencies, coverage and temporary captures are left out.

Beyond code quality, the linter enforces the architecture boundaries, size and complexity limits listed in
[ADR 0003](adr/0003-oxlint-boundaries.md).

The rules check Hooks and effect dependencies, circular and duplicate imports,
accessibility (including `Link`, `Input` and `Label`),
explicit `any` and unused variables. In full mode, they also check unhandled
Promises, unsafe type operations and unnecessary suppression comments.
Warnings make the command fail, including in fast mode. Parameters and variables
that are intentionally unused can start with `_`.

`typecheck` stays separate (`tsc --noEmit`): it doesn't depend on Oxlint's experimental
type-check. `useGSAP` receives dependencies in a configuration object; it is not added
to `additionalHooks`, which expects the signature with a dependency array.

The exceptions are local: the initial focus of the microphone, reactions and
share popovers allows keyboard navigation. In `SignUpForm`, the autocomplete rule
is off because [Oxlint's implementation](https://github.com/oxc-project/oxc/blob/main/crates/oxc_linter/src/rules/jsx_a11y/autocomplete_valid.rs)
rejects `nickname`, which is [valid in the HTML standard](https://html.spec.whatwg.org/multipage/form-control-infrastructure.html#autofill-detail-tokens).
Remove the exception once Oxlint accepts that token.

`oxlint.fast.config.mjs` reuses the main configuration and turns off only the type
engine and unused-suppression detection, since suppressions of type-aware rules
cannot be evaluated in that mode. Use `pnpm lint:fast` for quick local feedback;
it doesn't replace `pnpm lint` or `pnpm typecheck`.

If Windows shows "Controle de Aplicativo bloqueou este arquivo" ("Application Control blocked this file") when starting
`tsgolint.exe`, the full lint fails because of an operating-system restriction.
In that environment you can run `pnpm lint:fast` and `pnpm typecheck` separately,
but validating the type-aware rules requires an environment that allows that executable.
[Windows Smart App Control](https://support.microsoft.com/en-us/windows/security/threat-malware-protection/smart-app-control-frequently-asked-questions)
doesn't offer individual exceptions; on managed machines, ask the administrator
responsible for the application policy. For full validation in CI, run `pnpm lint`,
`pnpm typecheck`, `pnpm test` and `pnpm build`.

On a clean checkout, run `pnpm typecheck` before `pnpm lint`: the type-aware linter
requires the generated React Router route types. GitHub and local CI use this order.

> In production and locally, `pnpm start` runs the Hono server built from `app/server.ts` (`build/server/index.js`, port from `PORT`). The Docker image includes only production dependencies, the SSR build, assets and the migration scripts.

## Common problems

| Symptom                                                                           | Cause and fix                                                                                                                                          |
| --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Integration tests fail with `ECONNREFUSED 127.0.0.1:54329`                        | The dev Postgres isn't running (happens after restarting Docker). Run `pnpm db:bootstrap:dev`.                                                         |
| Room E2E tests fail and the log shows `failed to generate token` (`ECONNREFUSED`) | The dev LiveKit isn't running. Run `docker start lk-dev` (or the `docker run` above, the first time).                                                  |
| `http://localhost:3111` opens another app                                         | Another process holds port 3111 on IPv6, and `localhost` resolves to `::1` first. Use `http://127.0.0.1:3111`.                                         |
| `pnpm dev` fails with "Port 3111 is already in use"                               | Another dev server (often another worktree) is running. Stop it: the port is fixed so saved browser logins keep working.                               |
| Sign-in or any form fails with 403 in dev                                         | `.env.local` still has `APP_URL=http://localhost:3000`, or the page is open on `localhost`. Set `APP_URL=http://127.0.0.1:3111` and open that address. |
| Port 3100 taken when running E2E                                                  | Set `E2E_PORT` in the environment before `pnpm test:e2e`.                                                                                              |

## Host controls

Host controls use a private signaling admission gate and are disabled by default.
See [host controls](host-controls.md) for the environment flag, migrations and dedicated
Playwright command. Local loopback LiveKit is sufficient for functional testing.

With the flag on, "Banir desta chamada" is the session exclusion (`room_session_members`);
with it off, bans stay in `room_bans`, keyed by the LiveKit room sid. Drop `room_bans` and
its flag-off path once production runs with the flag on
([ADR 0007](adr/0007-room-ownership-and-host.md)).

## Collaboration pilot

Apply migrations 0013–0015 and enable `ROOM_HOST_CONTROLS_ENABLED=true` only with the private
LiveKit signaling boundary from [host controls](host-controls.md). Account and team Pro
allowances are independent and manually provisioned by a platform admin at `/admin/pro`.
The pilot keeps the existing participant limit. See [collaboration workspaces](collaboration-workspaces.md).

```bash
pnpm test:e2e
E2E_HOST_CONTROLS=true pnpm test:e2e tests/e2e/host-controls.spec.ts tests/e2e/annotations.spec.ts tests/e2e/workspaces.spec.ts tests/e2e/collaboration-smoke.spec.ts
```

Run these sequentially: each E2E invocation recreates the same disposable database.
The production dependency audit is `pnpm audit --prod --audit-level=high`. The full audit
including development tooling separately reports the existing `braces`/`shadcn` advisory.

# Deployment and operations

Production guide: Coolify on a VPS, with self-hosted LiveKit, the app as a GHCR image and Postgres managed by Coolify. To run locally, see the [development guide](development.md).

## Deploying on Coolify

You will create two resources on the same server: LiveKit and the app.

### 0. DNS and keys

1. Create two A records pointing to the VPS IP:
   - `app.yourdomain.com` → React Router app
   - `lk.yourdomain.com` → LiveKit (signaling + TURN)

   If you use Cloudflare, leave `lk.` as DNS only (grey cloud). TURN and WebRTC need the real IP.

2. Generate a key pair:

   ```bash
   docker run --rm livekit/livekit-server:v1.13.7 generate-keys
   # or: echo "API$(openssl rand -hex 6)"  and  openssl rand -base64 48
   ```

### 1. VPS firewall

```bash
ufw allow 7881/tcp           # WebRTC over TCP (fallback)
ufw allow 50000:50100/udp    # WebRTC media
ufw allow 3478/udp           # TURN/UDP
ufw allow 30000:30100/udp    # TURN relay ports
ufw allow 5349/tcp           # TURN/TLS (only if enabled, see below)
```

Do **not** open 7880: it goes through Coolify's HTTPS proxy. If your provider has its own firewall (Hetzner, AWS etc.), open the same ports there too.

### 2. LiveKit resource (Docker Compose)

1. - New Resource → Docker Compose pointing to [Nelcota/NelcotaScreenShare](https://github.com/Nelcota/NelcotaScreenShare).
2. In _Docker Compose Location_, use `/docker-compose.livekit.yml`.
3. Edit `deploy/livekit/livekit.yaml` and replace `lk.yourdomain.com` with your domain (`turn.domain`).
4. In Environment Variables, set `LIVEKIT_API_KEY` and `LIVEKIT_API_SECRET`.
5. Don't fill in a domain on the service. With `network_mode: host`, the proxy can't discover the container through labels; the route is created in step 3.
6. Deploy. The logs should show `starting LiveKit server` with `rtc.portICERange: [50000, 50100]` and `Starting TURN server`.

### 3. HTTPS proxy for `lk.yourdomain.com` → 7880

In Servers → (your server) → Proxy → Dynamic Configurations, add a `livekit.yaml` file (Traefik):

```yaml
http:
  routers:
    livekit-http:
      rule: Host(`lk.yourdomain.com`)
      entryPoints: [http]
      middlewares: [livekit-https]
      service: livekit
    livekit:
      rule: Host(`lk.yourdomain.com`)
      entryPoints: [https]
      service: livekit
      tls:
        certResolver: letsencrypt
  middlewares:
    livekit-https:
      redirectScheme:
        scheme: https
  services:
    livekit:
      loadBalancer:
        servers:
          - url: http://host.docker.internal:7880
```

Coolify's proxy already resolves `host.docker.internal` to the host. If it doesn't on your server, use the Docker bridge gateway (`http://172.17.0.1:7880`) and allow traffic from the containers to 7880:

```bash
ufw allow from 172.16.0.0/12 to any port 7880 proto tcp
ufw allow from 10.0.0.0/8 to any port 7880 proto tcp
```

To test: `curl https://lk.yourdomain.com` should respond `OK`.

### 4. App resource (GHCR image)

The image is built on **GitHub Actions** (not on the VPS, so it doesn't compete with the app for CPU and memory) and published to `ghcr.io/nelcota/nelcota` with three tags: `:<sha>` (immutable), `:main` and `:latest`.

The package belongs to the `Nelcota` organization and keeps the lowercase `nelcota` image name. The workflow labels each image with its source repository, `Nelcota/NelcotaScreenShare`. After the first successful publication in the organization, update existing Coolify image resources to `ghcr.io/nelcota/nelcota:latest` (or `:main`) and configure a GHCR read credential with access to the organization's package.

1. In Coolify: New Resource → **Docker Image** → `ghcr.io/nelcota/nelcota:latest` (with a GHCR read credential). Ports Exposes: `3000`. Domains: `https://app.yourdomain.com`.
2. Environment Variables (runtime):

   ```
   DATABASE_URL=postgres://nelcota_app:<password>@<postgres-internal-host>:5432/nelcota
   LIVEKIT_API_KEY=<same as LiveKit>
   LIVEKIT_API_SECRET=<same as LiveKit>
   LIVEKIT_URL=wss://lk.yourdomain.com
   ACCESS_PASSWORD=<optional>
   MAX_PARTICIPANTS=6
   SENTRY_DSN=<optional>
   AUTH_SECRET=<openssl rand -base64 48>
   ADMIN_AUTH_SECRET=<another openssl rand -base64 48; enables /admin>
   APP_URL=https://app.yourdomain.com
   RESEND_API_KEY=<sending-only key scoped to your verified domain>
   MAIL_FROM=Nelcota <no-reply@yourdomain.com>
   ```

   `APP_URL` is required in production. It is also the origin published in `/robots.txt`, `/sitemap.xml` and the link previews (Open Graph), so only `/`, `/novidades` and `/privacidade` are indexable. Leave `ACCESS_PASSWORD` empty for a public instance. For Resend, verify the sender's domain with the DNS records supplied by Resend, create a sending-only API key scoped to that domain, and set `RESEND_API_KEY` and `MAIL_FROM` as runtime secrets. The server calls the [Resend Email API](https://resend.com/docs/api-reference/emails/send-email) over HTTPS; keep `SMTP_URL` unset. For SMTP instead, set `SMTP_URL` and `MAIL_FROM` and leave `RESEND_API_KEY` unset. Configuring both providers fails validation. Enabling delivery does not change `REQUIRE_EMAIL_VERIFICATION`.

   E-mail delivery is optional: leave `RESEND_API_KEY`, `SMTP_URL`, and `MAIL_FROM` unset and keep `REQUIRE_EMAIL_VERIFICATION=false` to run without delivery. Password recovery and account e-mails cannot be delivered in this mode; message contents and recovery links are not logged in production. A provider and sender are required before enabling e-mail verification (`server/env.server.ts`).

3. Keep rolling updates on (no host port mapping and no fixed container name). The Dockerfile's `HEALTHCHECK` queries `/api/health`; the container runs as a non-root user (`nelcota`).

The runtime image includes `curl` for Coolify's generated HTTP health check. Startup logs
separate `runtime initialized` (`runtimeMs`, `sentryEnabled`) from `server listening`
(`processMs`, `cpuMs`, `rssMb`). A long elapsed time with little CPU time indicates waiting or
limited CPU availability; compare host load and disk activity before attributing it to database
work. The database pool is lazy and startup does not run queries or migrations.

**Pipeline** (`.github/workflows`): `ci.yml` runs formatting, lint, types, `pnpm audit`, tests (with Postgres 18.6) and build on every PR. On `main`, `deploy.yml` does: image to GHCR → **migration** (SSH to the VPS, `docker run` of the new image with the migration user) → Coolify webhook → waits for `/api/ready` to respond with the new SHA. If the migration fails, nothing is deployed.

GitHub secrets (`production` environment): `DEPLOY_SSH_KEY`, `DEPLOY_KNOWN_HOSTS`, `DEPLOY_HOST`, `DEPLOY_USER`, `MIGRATOR_DATABASE_URL`, `COOLIFY_DEPLOY_WEBHOOK`, `COOLIFY_TOKEN`. Variables: `APP_URL`, `DEPLOY_DOCKER_NETWORK` (default `coolify`), `PUBLIC_SENTRY_DSN` (optional). On the server, the deploy user needs `docker login ghcr.io` once.

#### Interim deployment from Git

If GitHub Actions is unavailable or the GHCR pipeline has not been configured, keep the Coolify resource on **Dockerfile**, with the Git source pointing to `https://github.com/Nelcota/NelcotaScreenShare`, Docker build cache enabled and `SOURCE_COMMIT` available only at runtime. The production resource currently uses this path. Automatic deployments are disabled: merge a batch of reviewed changes, then deploy `main` once from Coolify. Git submodules and Git LFS are disabled because this repository uses neither.

Before deploying a batch, check for pending database migrations. The app does not migrate on startup; apply new migrations with the migration user and the new image before deploying code that requires them. Keep the rolling update and `/api/ready` health check enabled. The production resource uses a 10-second start period, a 5-second interval and timeout, and 10 retries.

If a burst has already filled the queue, cancel queued deployments of superseded commits, let any rolling update in progress finish, and deploy the current `main`. Check `/api/ready` for the expected commit SHA and a healthy database. The CI builds the Docker image once and shares its BuildKit cache with the GHCR publication job.

To enable the GHCR pipeline, first resolve any GitHub Actions billing block, configure the secrets and variables above, and enable the `Deploy` workflow. Verify image publication and migrations before switching the Coolify resource to **Docker Image**. Keep direct Git auto-deploy disabled so only the pipeline triggers production deployments.

#### Required checks on main

During normal operation, the hosted `CI` workflow is enabled. The required checks on `main` are `Lint, formatting, types and audit`, `Tests (unit + integration on Postgres)`, `Production build`, and `E2E (real Playwright, Postgres and LiveKit)`, all from the GitHub Actions app. Changes require a PR, successful checks, and a branch up to date with `main`.

#### Local CI while hosted runners are unavailable

When hosted runners are unavailable, run CI on the developer's computer and publish actual results as `Local CI / quality`, `Local CI / tests`, `Local CI / build`, and `Local CI / e2e`. During this fallback, replace the four hosted requirements on `main` with these local statuses and disable the hosted `CI` workflow. Keep PRs and the requirement to be up to date with `main` enabled. The `Deploy` workflow stays disabled until hosted runners and the production configuration are ready.

Use PowerShell 7, Node 26.9 or newer, pnpm, Docker, and authenticated GitHub CLI. Start the development Postgres and LiveKit described in [development](development.md), and set `TEST_DATABASE_URL` in the environment or `.env.local` to a disposable test database. Integration tests recreate template/worker databases and E2E recreates `nelcota_e2e`, so use the test Postgres only. Run `pnpm ci:local` to validate the working tree. The command runs formatting, lint, types, unused-code and duplication checks, schema generation, dependency audit, coverage, Docker build, and Chromium E2E; any failed command stops validation.

To publish checks, commit and push the reviewed changes, rebase onto `origin/main`, and run `pnpm ci:local -Publish -PullRequest <number>` from a clean working tree. Publication verifies that the PR head matches the exact local commit before reporting each result. Logs and a JSON receipt are saved under `output/local-ci/<sha>/` and are excluded from Git and the Docker context. Use these receipts when reviewing local results. A failure is published as a failure; checks that did not run remain pending.

After all four required local checks pass, merge through the PR and deploy `main` once in Coolify. Before restoring hosted CI, enable the workflow and verify a successful run, then restore the four original required checks from the GitHub Actions app.

> The rate limit is in memory: it holds for a single replica (the Coolify default). To scale horizontally, switch to Redis.
>
> The IP used for rate limiting is taken from `X-Forwarded-For` counting from the end, according to `TRUSTED_PROXY_HOPS` (Traefik = 1). If `app.` also goes through the Cloudflare proxy, use `TRUSTED_PROXY_HOPS=2`. The same count tells Express which proxies to trust for `X-Forwarded-Proto`: the app must see `https` requests, or React Router refuses every browser action (400) because its `Origin` is `https://`.
>
> **Rollback:** the `:main` and `:latest` tags change on every deploy. To go back a version published in the organization, point the resource to `ghcr.io/nelcota/nelcota:<previous-sha>` (immutable tag) and redeploy; migrations are always additive (expand/contract), so the previous code works with the new schema.

### 4.1. PostgreSQL

1. In Coolify, create a **PostgreSQL** resource with the `postgres:18.6-alpine` image, in the same project and server as the app. Do **not** make the port public.
2. In "Custom PostgreSQL configuration", paste `deploy/postgres/postgresql.conf` (it **replaces** the whole file; the values are annotated for 4 and 8 GB VPSs). Restart the database.
3. Run the bootstrap once as the superuser (instructions at the top of `deploy/postgres/bootstrap.sql`) and save the three generated passwords.
4. The App's `DATABASE_URL` uses `nelcota_app`; `MIGRATOR_DATABASE_URL` (GitHub secret) uses `nelcota_migrator`. Both with the Postgres **internal** host.
5. Enable Coolify's scheduled backups to an S3-compatible store (daily, 03:00).

### 5. TURN/TLS (optional, for very restrictive networks)

TURN/UDP (3478) is already on. TURN/TLS on 5349 gets through firewalls that only let TLS through, but it needs a valid certificate for `turn.domain`:

1. Generate the certificate with a DNS challenge, since port 80 belongs to the proxy:
   `certbot certonly --manual --preferred-challenges dns -d lk.yourdomain.com`
   (or use your DNS provider's plugin, for automatic renewal).
2. In `deploy/livekit/livekit.yaml`, uncomment `tls_port`, `cert_file` and `key_file`.
3. In `docker-compose.livekit.yml`, uncomment the certificates volume.
4. Open `5349/tcp` and redeploy.

### 6. Webhook (rooms and participations in the panel)

The app receives LiveKit events at `POST /api/livekit/webhook`. Each event is stored in `livekit_events` (the event id prevents duplicates) and projected into `rooms`, `room_participations` and `share_sessions`, which feed the admin panel. The projection accepts repeated and out-of-order events. The signature is checked with `LIVEKIT_API_KEY`/`LIVEKIT_API_SECRET`: without it, the route responds 401. With the database down, it responds 503 and LiveKit retries.

1. In `deploy/livekit/livekit.yaml`, replace `api_key` in the `webhook` block with the value of `LIVEKIT_API_KEY` and the URL with the app's domain.
2. Redeploy LiveKit.
3. Check: join a room and run `select event, processed_at, error from livekit_events order by received_at desc limit 5;`.

In development, `deploy/livekit/livekit.dev.yaml` points the webhook to `http://host.docker.internal:3111` (see the top of the file).

Every request to `/api/token` is also stored in `token_requests` (result, account and IP), which ties each join to its source IP.

## Testing in production

### Two different networks

1. Computer A on the home/office Wi-Fi; computer or phone B on 4G (phone hotspot).
2. Both join the same room. A shares the screen; B should see the stage within seconds.
3. Also test from a corporate network/VPN, which is where TURN is usually needed.

### Checking `relay` (TURN) candidates

1. In Chrome, open `chrome://webrtc-internals` **before** joining the room.
2. Join and share the screen. On the `RTCPeerConnection` connection, open Stats Tables and look for the `candidate-pair` with `state: succeeded` / `nominated: true`.
3. Look at that pair's `remote-candidate` / `local-candidate`:
   - `candidateType: host` or `srflx` → direct connection over UDP (ideal);
   - `candidateType: relay` → went through TURN.
4. To **force** a TURN test, temporarily block direct media on the VPS and reconnect:

   ```bash
   ufw deny 50000:50100/udp && ufw deny 7881/tcp
   # join the room: the nominated pair should be "relay"
   ufw delete deny 50000:50100/udp && ufw delete deny 7881/tcp
   ```

   If it doesn't connect with those ports blocked, check `3478/udp`, `30000-30100/udp` and `turn.domain`.

5. From the server: in the LiveKit logs, each person's `participant active` line includes `connectionType` (`udp`/`tcp`) and the `publisherCandidates` list. The candidate marked `[remote][selected:1]` shows the type used (`host`, `srflx` or `relay`).

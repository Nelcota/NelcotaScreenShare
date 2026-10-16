# Coolify release gate

The production Dockerfile resource follows `main` through its signed GitHub push
webhook. Coolify creates the candidate container while the healthy container keeps
serving. The candidate's host-managed entrypoint requests a backup and migration
job over a Unix socket, then starts the server only on HTTP 200. `/api/ready` and
Coolify's rolling update decide when traffic moves to the candidate.

The native pre-deployment command executes inside the **old** container, so it
cannot reliably migrate the image about to be deployed. This gate instead inspects
the candidate and runs `node migrate.mjs` in its exact immutable image ID. Migrations
remain a separate job; the web process never receives DDL credentials or Docker
access. The same gate covers redeploys and rollbacks, including older images.

## Install on the application server

Use Python 3.11 or newer, Docker, and the production image's existing `curl` binary.
Copy `gate.py` to `/opt/nelcota-deploy-gate/` (root-owned, mode 644), `start.sh` to
`/opt/nelcota-deploy-gate/socket/start.sh` (root-owned, mode 755), and the service unit
to `/etc/systemd/system/`. Create the socket/client directory as root, mode 755.
Its persistent location keeps the entrypoint available after a host reboot; the
service recreates its socket on startup.

Create `/etc/nelcota-deploy-gate.json`, owned by root, mode 600:

```json
{
  "application_uuid": "COOLIFY_APPLICATION_UUID",
  "database_container": "COOLIFY_DATABASE_CONTAINER_NAME",
  "database": "nelcota",
  "network": "coolify",
  "backup_directory": "/root/nelcota-backups",
  "socket": "/opt/nelcota-deploy-gate/socket/gate.sock",
  "socket_gid": 1001,
  "migrator_database_url": "postgresql://DEPLOY_ROLE:PASSWORD@DATABASE:5432/nelcota?options=-c%20role%3Dnelcota_migrator"
}
```

Create a dedicated login role with `NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE`,
grant it `CONNECT` on `nelcota` and membership of `nelcota_migrator`, and set its URL's
startup role to `nelcota_migrator`. Schema ownership and default app grants then
remain correct. Store the generated password only in the root configuration.
The host gate reads the existing database container's administrator credential
in memory for `pg_dump`; it never passes this credential to the migration job.

Enable and start `nelcota-deploy-gate.service`. Bind the socket/client directory
into the application at `/run/nelcota-deploy` using Coolify Storage (directory
source `/opt/nelcota-deploy-gate/socket`, mount path `/run/nelcota-deploy:ro`).
Keep the host directory root owned.
Set Custom Docker Options to `--entrypoint=/run/nelcota-deploy/start.sh`. Keep
`SOURCE_COMMIT` injected by Coolify, production previews disabled, the Dockerfile
build pack, dynamic container names, no host port mapping, and `/api/ready` health
checks. Allow a 30-second health start period and 60 retries at 5-second intervals.
No native pre/post-deployment command or elevated application environment is needed.

## Failure and backup behavior

Every new candidate container receives a custom-format `pg_dump` before migrations,
even if its release has no pending SQL. A nonempty archive must pass
`pg_restore --list`; the protected receipt records its SHA-256 and release image.
Backups and receipts are mode 600 under `/root/nelcota-backups` (mode 700), outside
application containers. Monitor disk capacity and copy backups off the server;
these per-deployment backups complement scheduled off-server database backups.
They are retained until an operator removes them.

Backup, archive validation, job timeout, migration, or socket failures prevent the
server from starting. Coolify rejects the unhealthy candidate and keeps the healthy
version. A failed container remains blocked across restart attempts; use a **new
deployment** after correcting the cause. A successful container restart reuses its
receipt. Overlapping migration requests are serialized, with a bounded lock wait.
The existing PostgreSQL advisory lock also protects the migration transaction.

Inspect `journalctl -u nelcota-deploy-gate` for safe stage/status events and the
root-only `deploy-<container-id>.json` receipt for backup location, checksum and
protected failure log path. Raw diagnostics stay in the root-only failure log.
Do not restore production automatically after a failure: the old application can
still be writing. Restore an archive into an isolated database with `pg_restore
--exit-on-error` first, validate it, and coordinate any production recovery. Keep
schema changes compatible with the previous application version.

## Validation

`python3 deploy/coolify/test_gate.py -v` tests ordering, immutable image selection,
backup/validation/migration failure, retries, authorization, concurrency and the
entrypoint's success/failure behavior. The unit suite invokes it automatically.
The build job also runs `sudo python3 deploy/coolify/test_docker.py nelcota-ci`
against the newly built image and disposable PostgreSQL. It restores the archive,
injects an invalid migration, and verifies that backup, SQL and service failures
leave the application start marker absent. All test containers, images and networks
are removed afterward. The test requires a Docker-capable host; no production
configuration or credentials are used. Finally redeploy `main`, verify
the receipt and backup, and confirm `/api/ready` returns the expected release SHA.

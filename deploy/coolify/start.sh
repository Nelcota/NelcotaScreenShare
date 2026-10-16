#!/bin/sh
# Coolify overrides the entrypoint with this read-only, host-managed client.
set -eu
case "${HOSTNAME:-}" in ''|*[!a-f0-9]*) echo '[deploy-gate] Invalid container ID' >&2; exit 1;; esac
case "${SOURCE_COMMIT:-}" in ''|*[!a-f0-9]*) echo '[deploy-gate] Invalid commit' >&2; exit 1;; esac
[ "${#SOURCE_COMMIT}" -eq 40 ]
if [ "$#" -eq 0 ]; then set -- node build/server/index.js; fi
curl --silent --show-error --fail --max-time 300 \
  --unix-socket /run/nelcota-deploy/gate.sock \
  --header 'Content-Type: application/json' \
  --data "{\"container\":\"$HOSTNAME\",\"commit\":\"$SOURCE_COMMIT\"}" \
  http://localhost/run
exec "$@"

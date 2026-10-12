# Local collaboration validation

Validated on 2026-10-12 on `feature/collaborative-room-workspaces`. This is local
implementation evidence, not a production deployment or real-device media certification.
The host used Node 26.11.1 and pnpm 12.9.1. The production Docker image built on Node 26.9.0,
started as its unprivileged runtime user and returned `{"status":"ok"}` from `/api/health`.
The temporary startup container was removed after the probe.

| Check                                                          | Result                                                                     |
| -------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Whole-repository Oxfmt and format check                        | Passed                                                                     |
| React Router type generation and TypeScript                    | Passed                                                                     |
| Type-aware Oxlint                                              | Passed                                                                     |
| Unit/integration coverage run with real Postgres               | 531 tests in 94 files passed                                               |
| Coverage thresholds                                            | Passed; 46.72% lines, 45.65% statements, 40.01% branches, 36.45% functions |
| Full Chromium suite, default admission                         | 49 passed; 7 private-admission cases intentionally skipped                 |
| Full Chromium suite, private admission                         | 56 passed; none skipped                                                    |
| Production Vite/SSR build and bundled scripts                  | Passed                                                                     |
| Production Docker build and Node 26.9 startup/health probe     | Passed                                                                     |
| Knip                                                           | Passed                                                                     |
| Duplication                                                    | Passed; 0.84% lines against the 2% limit                                   |
| Migration generation                                           | No pending schema changes                                                  |
| Local forward migration and clean-database migrations in tests | Passed                                                                     |
| Production dependency audit, high/critical threshold           | Passed; no known production findings                                       |

The full audit including development dependencies still reports the pre-existing high
severity `braces@3.0.3` finding through the `shadcn` CLI, with no patched version listed by
the audit response. It is outside the production dependency set. No exception or audit
suppression was added. CI and local CI require the production-only audit.

The automated evidence covers server-authorized clearing by a host or signed guest
presenter, actual sender ownership, malformed/stale annotation payloads, caps and expiry,
viewport/fullscreen content bounds, newcomer-empty state, five concurrent participants,
two screens and three annotators. It also covers two calls under one permanent link,
archive/favorites, independent beta provisioning with audit, tenant/role boundaries,
concurrent invitation redemption, email verification, revocation/expiry, ownership
constraints, removal during an active call, cached-token rejection despite a failed
transport command, history pagination, account privacy and runtime database permissions.

Running the entire private-admission suite exposed a raise-hand integration that passed
an internal media name into the public-code API. It now uses the room context's public
code. A home-page initialization race could reset input entered before hydration; the
controlled room input now waits for hydration. The final full suites passed after these
fixes. Desktop/mobile room cards and annotation stages were inspected visually.

The collaboration smoke records synthetic capture conditions and join latencies in a
Playwright attachment. It validates behavior at the current limit, without claiming a
production throughput baseline or larger-room capacity. The PowerShell local-CI wrapper
was updated but was not executed on this host; its quality, test, build and browser
commands were run directly. This evidence was recorded before PR publication; no
production merge or external deployment was performed during this validation.

Remaining release gates are the actual VPS signaling isolation, real capture/audio on
supported desktop/mobile devices, production CPU/memory/bitrate/loss baselines and a
selected pilot. Provision beta subjects only after those checks; keep billing and larger
room limits outside this release. Operational and rollback instructions are in
[collaboration workspaces](collaboration-workspaces.md) and [host controls](host-controls.md).

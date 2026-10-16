# ADR 0003 — Architecture boundaries in oxlint (no dependency-cruiser)

- **Status:** accepted (2026-10-06)
- **Context:** we needed to stop the organization from getting mixed up again. The options evaluated were `dependency-cruiser@18.5.0`, `eslint-plugin-boundaries@7.2.0` and oxlint's own rules, which the project already uses with type information.

## Decision

The boundaries live in `oxlint.config.ts`, with `no-restricted-imports` per folder:

| Folder                                                                                    | Must not import                                                                                        |
| ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `components/**`, `lib/**`                                                                 | features, routes, server                                                                               |
| Each feature's UI, hooks and client (one override generated per feature from `features/`) | server, database, server SDKs, another feature's UI (except `features/mascot/ui` and the share notice) |
| `features/*/domain/**`, `features/admin/*/domain/**`                                      | React, React Router, database, SDKs, `@/server`                                                        |
| `server/**`                                                                               | features (except `domain/`), routes, components                                                        |

The protection is completed by:

- `import/no-cycle` prevents cycles;
- `max-lines` (300) and `complexity` (15) limit size and complexity, with no exception list;
- `nelcota/no-else` (local JS plugin in `tools/oxlint-plugin.ts`) bans `else` and `else if`, as AGENTS.md §1.1 requires; vendored `components/ui` is exempt;
- `knip` flags dead code;
- `jscpd` fails on duplication above 2%.

All of this runs in CI.

## Why not the alternatives

- **dependency-cruiser:** needs the TypeScript compiler's JS API to read `.ts`, and the installed TypeScript 7.0.2 doesn't expose it (`require("typescript").createSourceFile` is `undefined`). It would require installing and maintaining SWC just for that.
- **eslint-plugin-boundaries:** requires ESLint as a second linter, alongside oxlint.

## Consequences

- The rule works by path pattern, less precise than a graph, but enough here. The three violations planted as a test (another feature's UI, React in the domain, infrastructure importing a feature's server) were blocked.

## Revision (2026-10-07)

Two gaps found while reorganizing the folders:

- In oxlint, `*` doesn't cross `/`: `@/server/*` didn't catch `@/server/db/index.server`, and `@/features/*/server/*` didn't catch the panel subfeatures (`@/features/admin/rooms/server/...`). The patterns now use `**`.
- oxlint merges a rule's pattern groups, so the exception "a feature imports its own UI" (`!@/features/<name>/**`) also allowed the feature's server. The exception now covers only `ui/`.

Both were confirmed by planting the forbidden imports before and after the fix.

## Revision (2026-10-14)

`components/ui` is **vendored and adapted**: the files come from shadcn and are edited in place when the app needs it (the `Button`'s `loading`, `quiet` and `brand-outline`, the dialog's radius and title, the "Fechar" labels). A wrapper over them (`AppButton` and the like) would add a layer with no contract of its own. The `no-else` exemption stays, and a future `shadcn add` over an adapted file has to keep those edits.

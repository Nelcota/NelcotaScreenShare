# Accounts, admin panel and database

How participant accounts, the `/admin` panel, the audit log and PostgreSQL work. The code layout is in the [architecture guide](README.md).

## Database

The app uses **PostgreSQL 18** with **[Drizzle ORM](https://orm.drizzle.team)** (`drizzle-orm` + the `pg` driver). The original panel plan is preserved in the [historical archive](archive/admin-plan.md).

- The schema lives in `server/db/schema/` (one file per area). After changing the schema, run `pnpm db:generate`, review the SQL and commit it in `drizzle/`. CI fails if the schema and the migrations don't match.
- **Migrations never run at app boot.** They are a separate job (`scripts/migrate.ts`), with its own Postgres user, an advisory lock and a 5 s `lock_timeout`. Changes follow _expand/contract_ (the old code keeps working with the new schema).
- Editable settings live in `app_settings` (one row per group, a JSON value validated by Zod in `features/admin/settings/server/settings.server.ts`). A new settings group doesn't need a migration.
- `DATABASE_URL` is required: opening a room requires an account (guests, below, join one that is already open).
- **Retention (LGPD) and reprocessing:** every 6 h the app process itself (`features/runtime/server/maintenance.server.ts`) deletes token requests older than 6 months, strips the IP from participations older than 6 months and the name from those older than 12, deletes LiveKit events, e-mail delivery history, server error summaries and login failures older than 30 days and sessions expired for 7 days, and re-projects webhook events that failed.

### Guests

Whoever has the room link can join without an account. They type a name, receive a signed `nelcota_convidado` cookie (HMAC with `AUTH_SECRET`, 12 h, `HttpOnly`) and join as the LiveKit identity `convidado-<uuid>`, which the webhook records without a `user_id`. Rules (`features/room/domain/issue-token.ts`):

- a guest only gets in while someone with an account is connected (asked to LiveKit, so there is no webhook delay); otherwise `/api/token` answers `host_absent`;
- the room password and the room size still apply; panel invites (`?convite=`) still need an account;
- the room shows a guest's name with "(convidado)", so nobody passes for an account holder;
- before joining, a visitor without an account only sees how many people are inside.

### Postgres roles (least privilege)

| Role               | Can                                       | Used by                           |
| ------------------ | ----------------------------------------- | --------------------------------- |
| `nelcota_migrator` | owns the schema; DDL                      | migration job (secret only in CI) |
| `nelcota_app`      | read and write data; **no DDL**; timeouts | the app (`DATABASE_URL`)          |
| `nelcota_readonly` | read only + statistics                    | diagnostics and restore testing   |

The roles are created once with `deploy/postgres/bootstrap.sql` (idempotent). In dev, `docker-compose.dev.yml` runs the bootstrap by itself with fixed development passwords.

## Participant accounts

Joining a room (and creating one) requires an **account** (and a confirmed e-mail, if `REQUIRE_EMAIL_VERIFICATION=true`). It is a second Better Auth instance at `/api/auth` (`users*` tables, `nelcota.*` cookie, `SameSite=Lax`), separate from the admin panel.

- **Sign-up:** display name, e-mail and password (8 to 128 characters, argon2id) and acceptance of the [privacy notice](../app/routes/privacy.tsx). With `REQUIRE_EMAIL_VERIFICATION=true`, signing up with an e-mail that already exists gets the same response as a new sign-up, and the e-mail's owner receives a notice.
- **Known risk while e-mail confirmation is off (security audit S-01):** a new sign-up signs in at once and an existing e-mail is refused, so the sign-up form tells whether an e-mail has an account. A neutral answer alone cannot hide it: the new account gets a session and the existing one does not. The fix is turning on `REQUIRE_EMAIL_VERIFICATION` as soon as e-mail delivery works in production; it also makes participant operations require a confirmed e-mail. Until then the per-IP sign-up limit (5 per 10 min) only slows it down.
- Optional **e-mail confirmation** (`REQUIRE_EMAIL_VERIFICATION`, off by default; 24 h link; in dev the link shows up in the server log). After confirming, the person is signed in and returns to where they were (e.g. the room).
- **In the room:** the LiveKit identity is the account ID and the name comes from the account (the token doesn't allow changing the name inside the room; "levantar a mão" ("raise hand") goes through the server at `POST /api/sala/mao`, and so does "Sem som" (stopped hearing the room) at `POST /api/sala/som`, which writes the `deafened` attribute everyone sees on the tile). The same account in a second tab disconnects the first one, with a notice.
- **My account (`/conta`):** profile (photo, name and e-mail), security (password and 2FA), connected devices and privacy (data export and account deletion). The photo accepts JPG, PNG and WebP up to 5 MB, with a preview before saving; it is center-cropped and scaled down to a 256 × 256 px avatar. Changing the e-mail requires confirmation at the new address. Deletion anonymizes the account immediately.
- **Calling a friend ("Chamar"):** rings the friend on any page for 90 s (sound for the first 60). Outside a call, "Chamar" opens a room that asks for approval; the friend who accepts goes straight in, and so does whoever rang. Ringing into a room that asks for approval lets the friend skip the queue only when the owner, a moderator or the elected host rings; anyone else's friend asks like everyone. Declining and "nobody answered" are told to the caller at once.
- **Joining without the pre-join (decided 2026-10-14):** calling and answering go straight into the call, like a phone; "Criar sala" keeps the pre-join, since there you wait for others. The direct entry follows the saved "Entrar com microfone ligado" setting, and a pill in the call says for 3 s how the microphone came in and which key switches it ("Microfone ligado · M para desligar").
- Same protections as the admin: lockout after failed attempts, rate limiting in the database, origin checks and messages that don't reveal whether the e-mail exists. An account blocked from the panel can neither sign in nor open a session.

## `/admin` panel

The panel uses its **own [Better Auth](https://www.better-auth.com) instance** at `/api/admin/auth` (`admin_*` tables, `nelcota-admin.*` cookie), separate from any participant account.

- **Invitation only:** there is no public sign-up and no default password. The first owner is created with the script below; other admins are invited from the panel.
- **Password:** argon2id (OWASP: 19 MiB, 2 iterations), 12 to 128 characters.
- **Mandatory TOTP 2FA** for every panel role, `viewer` included: it changes nothing but sees participants' e-mails, IPs and browsers (authenticator app + 10 single-use backup codes). Without 2FA, the session can only reach the screen to set it up.
- **Database-backed session** (no cookie cache): expires after 12 h of inactivity, absolute maximum of 7 days, `HttpOnly` + `Secure` + `SameSite=Strict` cookie. Critical actions require a login within the last 10 min.
- **Lockout after failed attempts:** 5 wrong passwords on the same account from the same network (the IP, or its /64 for IPv6) lock it there for 15 min (doubling every 5, up to 24 h), so someone guessing from elsewhere never locks the owner out; 20 failures from the same IP in 15 min block the IP. Wrong passwords on the signed-in routes that check it (changing the password, the 2FA routes) count too, and a password reset clears the account's failures. On top of that, Better Auth's rate limit (5 logins/min per IP), stored in the database.
- **No enumeration:** login, password recovery and invitation respond the same whether or not the e-mail exists.
- **CSRF:** Better Auth checks the origin; in addition, the route rejects any cross-origin request (including the first login, without a cookie).
- **Permissions:** `owner`, `admin` and `viewer` roles; the permission matrix is defined once in `features/auth/server/permissions.server.ts`. Every protected loader calls `requireAdmin(...)`. Panel operations go through `defineAdminOperation` (session, 2FA, permission and fresh session checked on the server).
- **Panel link in Configurações:** the owner turns it on per app account in Participantes > detail (`user.admin_link`, recent sign-in, audited). Only those accounts see "Abrir o painel" in `/conta`; the list lives in `app_settings` (`admin_link`, up to 50 accounts). The link opens the panel's own sign-in, which still asks for the panel password and the 2FA code; it grants nothing by itself. It is an in-app link, so a call going on survives.
- **Team (`/admin/equipe`, `owner` only):** everyone with panel access (role, 2FA, last use of a session) and the pending invitations. The owner invites an admin or a reader (link valid 48 h, shown once; `admin_invitation.create`), revokes a pending invitation, ends someone's sessions, deactivates (account locked and every session ended) and reactivates. Every change needs a recent sign-in and a reason, and is audited (`admin_user.deactivate`, `admin_user.reactivate`, `admin_user.sessions_revoke`). Nobody changes their own account or an owner there; an owner who lost access is recovered with `create-owner --force` (below).

- **Audit log:** `audit_logs` records who did what, when, from where (IP, browser, `request_id`, always made by the server; an `X-Request-Id` sent from outside only reaches the logs, as `upstream_request_id`) and the field-by-field "before → after", with secrets masked. It is written in the **same transaction** as the change. The table is immutable (trigger + an app role without UPDATE/DELETE; deletion only after 5 years). Every operation declares `audit: "required" | "none"`; an audited operation that finishes without recording an entry fails. Panel logins, 2FA and password changes are also recorded. A wrong password is only counted in `login_failures` (for the lockout); the audit gets one row when a lockout starts, and only for an e-mail that is a panel account, so anonymous attempts cannot grow the table.
- **Shell:** collapsible sidebar (remembered in a cookie), breadcrumbs, search/command palette (`Ctrl/⌘ K`), loading, error and 404 states in pt-BR. The menu shows only what the role can open.
- **Status (`/admin/status`, `owner` and `admin`):** database, LiveKit and e-mail health, the deployed version, the last LiveKit webhook event and the events that failed to project. It says which e-mail setting is missing without ever showing keys, URLs or addresses, and shows the e-mail card as "Atenção" when the last send did not go out, and event errors show only a safe summary (raw errors can carry query parameters).
- **Live (`/admin/ao-vivo`, every role):** only who and when: each live room, the people in it, since when and whether someone is sharing (yes/no). Never screens, audio or chat. A room created with "Criar sala" also shows its owner and entry mode. Refreshes every 30 s. A room still live in the panel but gone from LiveKit (its `room_finished` webhook never arrived) is flagged; `owner` and `admin` can close it (`live.close`, audited as `room.close_ghost`). The server asks LiveKit again before closing and ends the room, participations and shares at the last activity seen.
- **Room staff (`/admin/salas/:id`, `room.read`):** for a room created with "Criar sala", the owner, the moderators and the entry mode, read from `room_roles` and `room_settings` by code. Deleted accounts are left out. Rooms joined straight by the link have no staff and the block is hidden.
- **Call removals (`/admin/salas/:id`, `room.read`; letting back needs `live.kick`):** while the call is live, who was banned from it, newest first, with the name used in the call and who did it (a member by name, or "pelo painel"). The list comes from `listCallRemovals`, so it works with host controls on or off (ADR 0007). "Deixar voltar" calls `readmitToSession` and is audited as `room.participant_unban`, the only record of who lifted the ban. When LiveKit does not answer, the block says so instead of showing an empty list.
- **E-mails (`/admin/emails`, `owner` and `admin`):** every transactional e-mail leaves a line in `mail_deliveries` (subject, recipient domain only, provider, accepted/refused/not sent, a known error code and attempts; kept 30 days). The page lists the latest deliveries with the reason in plain Portuguese, warns which setting is missing (naming the variable, never its value) and has a test button that sends only to the signed-in admin (audited as `mail.test`, 5 per 15 min).
- **Denied entries (`/admin/entradas`, `room.read`):** denied room joins from `token_requests`, counted per reason over 24 h and 7 days; a reason filters the list of the latest 50 (time, room and account, never the IP). Requests the owner or a moderator turned down in a room with approval (`room_join_requests` declined) count as "Pedido recusado", dated by the decision.
- **Pro waitlist (`/admin/lista-pro`, `participant.read`):** how many people asked to hear about the Pro launch and the latest 100 sign-ups. The CSV export (e-mail and date) needs `participant.export` and is audited as `pro_interest.export`.
- **Errors (`/admin/erros`, `audit.read`):** every unexpected server error also leaves a safe summary in `app_errors` (request id, method, path with tokens masked, error name and first line; database errors and e-mails never stored; kept 30 days). The page lists the latest 50 and links each to Sentry by `request_id` when `SENTRY_ISSUES_URL` is set.
- **Participant 2FA:** the participant list marks accounts with 2FA. On the detail page, only the `owner` can turn it off (`participant.disableTwoFactor`, recent sign-in and a reason required), for someone who lost their authenticator: the secret and backup codes are deleted, every session ends and the change is audited as `user.two_factor_disable`.
- **Photo and name (`participant.update`, `owner` and `admin`):** on the participant page, "Remover foto" clears the profile photo and "Redefinir nome" swaps the name for "Pessoa" and 4 digits. Both need a reason, are audited as `user.photo_remove` and `user.name_reset` (the old name is not kept) and e-mail the reason to the person, who may pick another photo or name. A failed e-mail does not undo the change; the admin is told. Both changes, with the reason, go into the person's data export (`alteracoes_feitas_pela_equipe`).
- **Friends and blocks (`participant.read`):** the participant page shows only how many accepted friends the account has and how many blocks it made and received. Never the names, the friend list, conversations or status.
- **Daily usage (`/admin/uso`, `dashboard.read`):** for the last 14 days in São Paulo time, rooms opened, distinct people and minutes in calls per day (a stay counts on the day it started), plus the browsers of the account sessions still open (nothing new is stored for it). A second block counts messages sent, groups created and friend requests per day, from the existing tables: counts only, and what was deleted since no longer counts.
- **Reports (`/admin/denuncias`, `report.read`/`report.resolve`, `owner` and `admin`):** people with an account report a person (from their card in the call), a message or a group (`reports-reportAction`, at most 10 per hour, one open report per target; the reported person never learns who). The queue opens each report with the minimum context: the reported message and the 5 before it in that conversation only. Actions, all audited: resolve without action, delete the message, block the account. A message report keeps a copy of that message only while open. Reports go into the reporter's data export; anonymization clears the text they wrote and the copies of their messages.
- **Security tests:** one test imports every panel operation and checks that none runs without a session; another checks that every protected page loader calls `requireAdmin`.

**Create the first owner:**

```bash
# Dev
pnpm admin:create-owner owner@example.com
# Production (app container in Coolify → Terminal, or via SSH)
docker exec -it <app-container> node create-owner.mjs owner@example.com
```

The command prints a single-use link, valid for 30 minutes. If the only owner loses their 2FA and backup codes, run it again with `--force` and the **same e-mail**: that account is locked, its sessions end and its 2FA is removed (audited as `admin.recovery_start`, actor `system`), and the link brings the same account back, with its history, a new password and 2FA to set up again. With `--force` and an e-mail that has no panel account, it issues a new owner invitation as usual.

Friend requests sent by email remain private to their recipient until accepted. They do not expose recipient names in the sender's outgoing list, relation endpoint, photo endpoint, or data export. Email and explicit code/card requests have separate pending quotas, so a blind lookup cannot be detected through a later public request limit.

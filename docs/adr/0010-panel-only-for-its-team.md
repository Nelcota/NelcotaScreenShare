# ADR 0010 — The admin panel exists only for its team

- **Status:** accepted (2026-10-20).
- **Context:** anyone who typed `/admin` saw the panel's sign-in, and `/api/admin/auth` answered too. The sign-in is protected (argon2id, lockout, mandatory 2FA), but it still told the world that a panel lives there and offered a door to knock on. The link "Abrir o painel" in Configurações came from a list of accounts the owner picked one by one (`admin_link` in `app_settings`). That list had to be kept in sync with the team by hand: removing someone from Equipe left their link on.

## Decision

- **The panel is hidden from anyone outside the team.** `/admin`, its data requests (`.data`) and `/api/admin/*` answer with the site's own 404, exactly like a wrong address, with the same title, the same bar and the same 405 for a wrong method. The panel goes through only when the request has:
  - a panel session;
  - an app account whose verified e-mail belongs to someone active on the team;
  - or the 30-minute pass below.
- **The check runs in the Hono layer, before React Router** (`features/auth/server/panel-visibility.server.ts`, called from `app/server.ts`). A hidden request is rewritten to `/nao-encontrado`, so React Router renders its own 404. This covers the sign-in without JavaScript and the panel's API, which a loader-level check would miss.
- **The path is matched the way React Router matches it:** decoded, ignoring case, with repeated slashes joined and without the `.data` suffix (`features/auth/domain/panel-paths.ts`). A path that cannot be decoded counts as the panel, so it is hidden too.
- **The team decides who sees the link, not a list.** "Abrir o painel" shows in `/conta` when the app account's e-mail is verified and equals, ignoring case, the e-mail of a panel account that is not deactivated (`isPanelMember`, `features/auth/server/panel-member.server.ts`). Deactivating someone in Equipe removes both the link and the access at once. The link grants nothing: the panel still asks for its own password and the 2FA code.
- **Nobody on the team is locked out.** A valid invitation, owner-recovery or new-password link always opens, the e-mailed `/api/admin/auth/reset-password/<token>` included. It grants a 30-minute pass (`nelcota-admin-pass`, `HttpOnly`, `SameSite=Lax`, signed with HMAC and `ADMIN_AUTH_SECRET`, `features/auth/server/admin-pass.server.ts`) so the person can sign in right after, even on a device without an app account. A wrong or expired token is a 404 like the rest.
- **Without `ADMIN_AUTH_SECRET` the panel is hidden from everyone.** No secret, no pass to verify.

## Discarded

- **Keeping the owner's list (`admin_link`).** It duplicated the team and drifted from it; the switch on each participant's page is gone. The row left in `app_settings` is cleaned up in a later change.
- **A visible 403 ("Sem permissão").** It confirms that the panel exists at that address. A 404 identical to any wrong address does not.
- **The check inside the panel's loaders.** It would leave out the API, the sign-in without JavaScript and any route added later without the check.
- **Hiding by IP or by a secret path.** IPs change with the network, and a secret path leaks in history, logs and screenshots.

## Consequences

- **Each request to `/admin` resolves the session in the middleware**, and the panel's loaders resolve it again: one extra lookup per panel page, accepted for now.
- **A team member signing in for the first time** on a device needs either the app account signed in (with the same verified e-mail) or the invitation or new-password link.
- **Tests:**
  - `tests/unit/panel-visibility.test.ts`, for the path rules and the pass;
  - `tests/integration/panel-visibility.test.ts` and `panel-member.test.ts`, against the database;
  - `tests/e2e/panel-team-only.spec.ts`, end to end.

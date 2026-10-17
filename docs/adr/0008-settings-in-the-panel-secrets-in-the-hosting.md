# ADR 0008 — Settings in the panel, secrets in the hosting

- **Status:** accepted (2026-10-16).
- **Context:** the E-mails page of the panel told the owner to set `RESEND_API_KEY`, `SMTP_URL` and `MAIL_FROM` in the hosting, and asking for each change was slow. The panel already saves settings in `app_settings` (the mascot's saturation), so the question was which environment variables may move there.

## Decision

- **Only what is not a secret moves to the panel.** The first one is the e-mail sender: the `mail` row of `app_settings`, validated by the same rule as `MAIL_FROM` (`lib/mail-sender.ts`).
- **The panel's sender wins; `MAIL_FROM` stays as the fallback.** A blank field goes back to `MAIL_FROM`, so nothing changes where the hosting already sets it. `sendMail` reads the row on every e-mail (`server/mail-sender.server.ts`): e-mails are rare, a save applies at once and, with the database down, `MAIL_FROM` still lets the e-mail out.
- **Only the owner edits it** (`settings.update`), and each change goes to the audit log with before and after, like the mascot.
- **Boot no longer requires `MAIL_FROM`.** It still requires a provider when `MAIL_FROM` is set or e-mail verification is on. Without a sender anywhere, the E-mails and Status pages say "Falta o remetente" and each e-mail is recorded as not sent.

## What stays in the hosting

- **Delivery credentials:** `RESEND_API_KEY` and `SMTP_URL`, which carries a password. Whoever controls delivery receives the password-reset e-mails and can take over any account. In the panel, one leaked admin password would become access to every account, and a database leak would hand over the key.
- **Secrets:** `AUTH_SECRET`, `ADMIN_AUTH_SECRET`, the LiveKit key and secret, `ACCESS_PASSWORD` and the Sentry DSN.
- **What the app needs before it can read the database:** `DATABASE_URL`.
- **Network and link security:** `APP_URL`, `TRUSTED_PROXY_HOPS` and `ROOM_HOST_CONTROLS_ENABLED`. A wrong value here opens a hole instead of only stopping e-mails.
- **Deployment:** `LOG_LEVEL` and `APP_VERSION`.

## Discarded

- **Secrets encrypted in the database, with the key in the hosting.** It still lets the panel replace the delivery credentials, which is the risk above, and it adds a key to rotate.
- **Moving `REQUIRE_EMAIL_VERIFICATION` and `MAX_PARTICIPANTS` now.** They are not secrets, but sign-in and room admission read them synchronously in many places. Turning verification on before delivery works would also lock out every new account. They can follow the same path in a later change.

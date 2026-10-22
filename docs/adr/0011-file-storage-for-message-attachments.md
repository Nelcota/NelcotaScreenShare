# ADR 0011 — File storage for message attachments

- **Status:** proposed (2026-10-20). Production waits for the bucket and its variables.
- **Context:** private conversations (/mensagens, direct and group) will carry attachments: up to 10 MB on the free plan, 100 MB on Pro and 1 GB between panel owners, decided by the sender's plan. Nelcota has nowhere to keep files. Postgres is the wrong place for files up to 1 GB, and the app's own disk is lost when Coolify replaces the container.

## Decision

- **Cloudflare R2, through our own small interface** (`server/storage/object-storage.server.ts`). The app talks to an `ObjectStorage`. It can:
  - hand out a short signed link to send a file and another to fetch one;
  - read an object's size and its first bytes;
  - delete an object.

  R2 is one adapter; development uses another. Nothing outside the adapter knows which one runs.

- **The browser sends the file straight to the storage.** A 1 GB upload must not go through the app server. The server signs a `PUT` link valid for a few minutes, for one object key it chose. Then, before the attachment shows up in the conversation, it checks:
  - the real size, with `HEAD`;
  - the type, from the first bytes with a ranged `GET`.

  If either fails, the object is deleted and the message is refused. The size the browser claims is never trusted.

- **Downloads are always attachments.** The object is written with `Content-Disposition: attachment` and `Content-Type: application/octet-stream`, signed into the upload link. The server checks membership, then hands out a short signed `GET` link. The file never opens as a page of the site. An SVG travels as a file.
- **Keys carry no personal data.** Keys are random (`attachments/<uuid>`); the original file name lives only in the database.
- **Development keeps the files on the local disk** (`createLocalDiskStorage` in `server/storage/local-disk-storage.server.ts`, under `.data/attachments`, which git ignores). Its signed links point to the app itself and are HMAC-signed with `AUTH_SECRET`, so the whole flow runs without a cloud account.

## Why R2

- **Downloads are free.** R2 charges no egress. At US$ 0.015 per GB-month, with the first 10 GB free, 100 GB of attachments costs about US$ 1.50 a month.
- **The VPS disk is not at risk.** A few 1 GB files cannot fill the disk Postgres and LiveKit share.
- **It speaks the S3 API.** Signed `PUT`, `GET`, `HEAD` and `DELETE` links are supported, with an expiry from one second to seven days. Coolify's database backups already go to an S3-compatible store.
- **Deleting is final.** A `DELETE` removes the object; there is no versioning unless it is turned on.

## Discarded

- **MinIO on Coolify.** The open-source project stopped publishing images in October 2025, went into maintenance in December 2025 and was archived in February 2026. It would also share the VPS disk and need its own backup.
- **Files in Postgres** (`bytea`). They would bloat the database, its backups and every restore.
- **Uploads through the app server.** The size check would be easy, but a 1 GB upload ties up the server and its memory.

## What the hosting needs (production, by Haniel)

- An R2 bucket, private, with a CORS rule allowing `PUT` and `GET` from `APP_URL` only.
- `ATTACHMENTS_STORAGE=r2`, plus four variables, checked at boot:
  - `R2_ACCOUNT_ID`;
  - `R2_ACCESS_KEY_ID` and `R2_SECRET_ACCESS_KEY`, from a token scoped to that bucket;
  - `R2_BUCKET`.
- The keys are secrets: they stay in the hosting (ADR 0008).

## To confirm on the real bucket

- That `Content-Disposition` signed into the `PUT` comes back on the signed `GET`, for every type.
- The CORS preflight for a large `PUT` from the browser.
- That the `Content-Length` signed into the `PUT` makes R2 refuse an upload of another size.

## Consequences

- **A new dependency for the R2 adapter: `aws4fetch`** (1.0.20, pinned).
  - It signs S3 requests and presigned links (AWS Signature V4) on top of `fetch`.
  - It is MIT-licensed, has no dependencies of its own, and Cloudflare's R2 documentation uses it in its presigned-link examples.
  - Discarded: the AWS SDK (`@aws-sdk/client-s3` with `@aws-sdk/s3-request-presigner`), dozens of packages for the four calls we make; and a signer written by hand, which is security code we would have to maintain.
- **The bucket's origin joins the Content-Security-Policy** (`connect-src` for uploads, `img-src` for photo previews), only when R2 is the storage.
- **Files outside the database need their own cleanup.**
  - Deleting a message removes its file at once.
  - A deleted account's files lose their sender, and a finished group's files lose their conversation: they are unreachable at once, and the maintenance sweep (every 6 hours) erases them.
  - Uploads never sent in a message are swept after a day.
- **"Baixar meus dados" lists the attachments the person sent** (name, kind, size, when); the files themselves are downloaded from the conversation.

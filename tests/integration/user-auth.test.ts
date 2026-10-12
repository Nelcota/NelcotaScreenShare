import assert from "node:assert/strict";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { afterAll, describe, test, vi } from "vitest";
import { z } from "zod";
import {
  ADMIN_AUTH_BASE_PATH,
  createAdminAuthForTests,
} from "@/features/auth/server/admin-auth.server";
import {
  createUserAuthForTests,
  USER_AUTH_BASE_PATH,
} from "@/features/auth/server/participant-auth.server";
import * as schema from "@/server/db/schema";
import { logger } from "@/server/logger.server";
import { verifiedParticipant } from "./support/accounts";
import { CookieJar, errorCode, makeCaller } from "./support/http-auth";
import { totpFromUri } from "./support/totp";
import { createEmailVerificationToken } from "better-auth/api";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema });
afterAll(() => pool.end());

const auth = createUserAuthForTests(db, "segredo-participantes-de-teste-0123456789abcdef");
const handler = (request: Request) => auth.handler(request);
let nextIp = 1;
function newCaller() {
  return makeCaller(handler, USER_AUTH_BASE_PATH, `198.18.0.${nextIp++}`);
}
const PASSWORD = "senha-do-participante-1";

/**
 * Without SMTP, local development logs the email: grabs the link from the last email to `to`.
 * Other environments keep recipients and links out of the log, so this runs as development.
 */
function captureMail() {
  vi.stubEnv("NODE_ENV", "development");
  const mails: { to: string; body: string }[] = [];
  vi.spyOn(logger, "warn").mockImplementation((entry: unknown) => {
    const mail = entry as { mail?: { to: string }; body?: string };
    if (mail.mail && mail.body) mails.push({ to: mail.mail.to, body: mail.body });
  });
  return {
    linkFor(to: string): string | undefined {
      const mail = mails.findLast((item) => item.to === to);
      return mail?.body.match(/https?:\/\/\S+/)?.[0];
    },
    count: (to: string) => mails.filter((item) => item.to === to).length,
  };
}

describe("sign-up", () => {
  test("new email and already registered email get the same response", async () => {
    const call = newCaller();
    const mail = captureMail();
    const body = { name: "Lia", email: "lia@exemplo.com", password: PASSWORD };
    const first = await call("/sign-up/email", { body });
    const again = await call("/sign-up/email", { body: { ...body, name: "Outra Pessoa" } });
    assert.equal(first.status, 200);
    assert.equal(again.status, first.status);
    assert.deepEqual(
      Object.keys(again.body as object).toSorted(),
      Object.keys(first.body as object).toSorted(),
    );
    // The email owner gets the verification and then the attempt notice.
    await vi.waitFor(() => assert.equal(mail.count("lia@exemplo.com"), 2));
    const rows = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, "lia@exemplo.com"));
    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.name, "Lia");
  });

  test("cannot sign in without verifying the email; the link verifies and signs in", async () => {
    const call = newCaller();
    const mail = captureMail();
    await call("/sign-up/email", {
      body: { name: "Mel", email: "mel@exemplo.com", password: PASSWORD, callbackURL: "/" },
    });
    const blocked = await call("/sign-in/email", {
      body: { email: "mel@exemplo.com", password: PASSWORD },
    });
    assert.equal(blocked.status, 403);

    const link = await vi.waitFor(() => {
      const found = mail.linkFor("mel@exemplo.com");
      assert.ok(found, "verification link in the email");
      return found;
    });
    const url = new URL(link);
    const jar = new CookieJar();
    const verify = await auth.handler(
      new Request(`http://localhost:3000${url.pathname}${url.search}`),
    );
    jar.store(verify);
    assert.ok([200, 302].includes(verify.status));
    const [row] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, "mel@exemplo.com"));
    assert.equal(row?.emailVerified, true);
    const session = await call("/get-session", { method: "GET", jar });
    assert.ok(
      session.body && typeof session.body === "object" && "user" in session.body,
      "signed in after verifying",
    );
  });

  test("short password is rejected", async () => {
    const res = await newCaller()("/sign-up/email", {
      body: { name: "Nina", email: "nina@exemplo.com", password: "curta" },
    });
    assert.equal(res.status, 400);
    assert.equal(errorCode(res.body), "PASSWORD_TOO_SHORT");
  });
});

describe("login", () => {
  test("account blocked from the admin panel gets no session", async () => {
    const ana = await verifiedParticipant(db, handler);
    await db.update(schema.users).set({ blockedAt: new Date() }).where(eq(schema.users.id, ana.id));
    const res = await newCaller()("/sign-in/email", {
      body: { email: ana.email, password: ana.password },
    });
    assert.equal(res.status, 401);
    assert.equal(errorCode(res.body), "FAILED_TO_CREATE_SESSION");
  });

  test("attempt lockout applies to participants, separate from admin", async () => {
    const bia = await verifiedParticipant(db, handler);
    for (let i = 0; i < 5; i++) {
      const res = await makeCaller(
        handler,
        USER_AUTH_BASE_PATH,
        `198.19.0.${i + 1}`,
      )("/sign-in/email", {
        body: { email: bia.email, password: `errada-${i}-xxxxxx` },
      });
      assert.equal(res.status, 401);
    }
    const locked = await makeCaller(
      handler,
      USER_AUTH_BASE_PATH,
      "198.19.0.99",
    )("/sign-in/email", {
      body: { email: bia.email, password: bia.password },
    });
    assert.equal(locked.status, 429);
    const [failure] = await db.select().from(schema.loginFailures).limit(1);
    assert.equal(failure?.scope, "user");
  });

  test("account cookie does not work in the admin panel", async () => {
    const caio = await verifiedParticipant(db, handler);
    assert.ok(caio.jar.has("nelcota."));
    const adminAuth = createAdminAuthForTests(
      db,
      "segredo-admin-de-teste-0123456789abcdef0123456789",
    );
    const adminCall = makeCaller(adminAuth.handler, ADMIN_AUTH_BASE_PATH, "198.18.1.1");
    const session = await adminCall("/get-session", { method: "GET", jar: caio.jar });
    assert.equal(session.status, 200);
    assert.equal(session.body, null);
  });
});

/** 1 px WebP: the endpoint receives the format produced by the editor. */
const WEBP_IMAGE =
  "data:image/webp;base64,UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA";

/** The same 1 px WebP with an EXIF chunk (metadata such as location). */
const WEBP_WITH_EXIF =
  "data:image/webp;base64,UklGRkAAAABXRUJQVlA4WAoAAAAIAAAAAAAAAAAARVhJRgQAAABHUFMhVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA";

const INVALID_IMAGES = [
  "https://example.com/photo.png",
  "data:image/svg+xml;base64,PHN2Zz4=",
  "data:image/webp;base64," + "A".repeat(180_001),
  "data:image/webp;base64,UklGRxxxxxxxxxxxxxxxxxxx",
  WEBP_WITH_EXIF,
];

describe("email change security", () => {
  test("initial email confirmation verifies a 2FA account without bypassing sign-in or locking it out", async () => {
    const participant = await verifiedParticipant(db, handler);
    await db
      .update(schema.users)
      .set({ emailVerified: false, twoFactorEnabled: true })
      .where(eq(schema.users.id, participant.id));
    const before = await db
      .select()
      .from(schema.userSessions)
      .where(eq(schema.userSessions.userId, participant.id));
    const token = await createEmailVerificationToken(
      "segredo-participantes-de-teste-0123456789abcdef",
      participant.email,
    );
    const response = await auth.handler(
      new Request(
        `http://localhost:3000/api/auth/verify-email?${new URLSearchParams({ token, callbackURL: "/conta" })}`,
      ),
    );
    assert.equal(response.status, 302);
    assert.equal(response.headers.get("location"), "/entrar?voltar=%2Fconta");
    assert.equal(
      response.headers
        .getSetCookie()
        .some((cookie) => cookie.includes("session_token=") && !cookie.includes("Max-Age=0")),
      false,
    );
    const current = await db.query.users.findFirst({ where: eq(schema.users.id, participant.id) });
    assert.equal(current?.emailVerified, true);
    assert.equal(current?.twoFactorEnabled, true);
    assert.equal(
      (
        await db
          .select()
          .from(schema.userSessions)
          .where(eq(schema.userSessions.userId, participant.id))
      ).length,
      before.length,
    );
  });
  test("an old session cannot send an email-change link", async () => {
    const participant = await verifiedParticipant(db, handler);
    const mail = captureMail();
    await db
      .update(schema.userSessions)
      .set({ createdAt: new Date(Date.now() - 2 * 60 * 60_000) })
      .where(eq(schema.userSessions.userId, participant.id));
    const newEmail = `old-session-${crypto.randomUUID()}@exemplo.com`;
    const response = await newCaller()("/change-email", {
      body: { newEmail },
      jar: participant.jar,
    });
    assert.equal(response.status, 403);
    assert.equal(errorCode(response.body), "SESSION_NOT_FRESH");
    assert.equal(mail.count(newEmail), 0);
    assert.equal(
      (await db.query.users.findFirst({ where: eq(schema.users.id, participant.id) }))?.email,
      participant.email,
    );
  });

  test("a 2FA email-change link resumes only after authenticating the same account", async () => {
    const participant = await verifiedParticipant(db, handler);
    const call = newCaller();
    const enabled = await call("/two-factor/enable", {
      body: { password: participant.password },
      jar: participant.jar,
    });
    assert.equal(enabled.status, 200);
    const setup = z.object({ totpURI: z.string() }).parse(enabled.body);
    assert.equal(
      (
        await call("/two-factor/verify-totp", {
          body: { code: totpFromUri(setup.totpURI) },
          jar: participant.jar,
        })
      ).status,
      200,
    );
    const mail = captureMail();
    const newEmail = `two-factor-${crypto.randomUUID()}@exemplo.com`;
    assert.equal(
      (
        await call("/change-email", {
          body: { newEmail, callbackURL: "/conta?aviso=email" },
          jar: participant.jar,
        })
      ).status,
      200,
    );
    const link = await vi.waitFor(() => {
      const found = mail.linkFor(newEmail);
      assert.ok(found);
      return found;
    });
    const verify = await auth.handler(new Request(link));
    assert.equal(verify.status, 302);
    assert.match(verify.headers.get("location") ?? "", /^\/verificar-email\?token=/);
    assert.equal(
      verify.headers
        .getSetCookie()
        .some((cookie) => cookie.includes("session_token=") && !cookie.includes("Max-Age=0")),
      false,
    );
    assert.equal(
      (await db.query.users.findFirst({ where: eq(schema.users.id, participant.id) }))?.email,
      participant.email,
    );

    const other = await verifiedParticipant(db, handler);
    const wrongAccount = await auth.handler(
      new Request(link, { headers: { cookie: other.jar.header() } }),
    );
    assert.equal(wrongAccount.status, 302);
    assert.match(wrongAccount.headers.get("location") ?? "", /^\/verificar-email\?token=/);

    const jar = new CookieJar();
    const signIn = await newCaller()("/sign-in/email", {
      body: { email: participant.email, password: participant.password },
      jar,
    });
    assert.equal(signIn.status, 200);
    assert.equal(
      z.object({ twoFactorRedirect: z.boolean() }).parse(signIn.body).twoFactorRedirect,
      true,
    );
    assert.equal(
      (
        await newCaller()("/two-factor/verify-totp", {
          body: { code: totpFromUri(setup.totpURI) },
          jar,
        })
      ).status,
      200,
    );
    const confirmed = await auth.handler(new Request(link, { headers: { cookie: jar.header() } }));
    assert.equal(confirmed.status, 302);
    assert.equal(confirmed.headers.get("location"), "/entrar?voltar=%2Fconta%3Faviso%3Demail");
    const account = await db.query.users.findFirst({ where: eq(schema.users.id, participant.id) });
    assert.equal(account?.email, newEmail);
    assert.equal(account?.twoFactorEnabled, true);
  });
});

describe("profile photo", () => {
  test("sign-up validates the photo with the same rules as the update", async () => {
    for (const invalid of INVALID_IMAGES) {
      const email = `foto-invalida-${crypto.randomUUID()}@exemplo.com`;
      const rejected = await newCaller()("/sign-up/email", {
        body: { name: "Foto", email, password: PASSWORD, image: invalid },
      });
      assert.equal(rejected.status, 400);
      assert.equal(
        await db.query.users.findFirst({ where: eq(schema.users.email, email) }),
        undefined,
      );
    }
    const email = `foto-valida-${crypto.randomUUID()}@exemplo.com`;
    const saved = await newCaller()("/sign-up/email", {
      body: { name: "Foto", email, password: PASSWORD, image: WEBP_IMAGE },
    });
    assert.equal(saved.status, 200);
    assert.equal(
      (await db.query.users.findFirst({ where: eq(schema.users.email, email) }))?.image,
      WEBP_IMAGE,
    );
  });

  test("saves and removes the account's own photo; rejects URLs, SVG and large images", async () => {
    const participant = await verifiedParticipant(db, handler);
    const call = newCaller();
    const saved = await call("/update-user", { body: { image: WEBP_IMAGE }, jar: participant.jar });
    assert.equal(saved.status, 200);
    const [row] = await db
      .select({ image: schema.users.image })
      .from(schema.users)
      .where(eq(schema.users.id, participant.id));
    assert.equal(row?.image, WEBP_IMAGE);
    for (const invalid of INVALID_IMAGES) {
      const rejected = await call("/update-user", {
        body: { image: invalid },
        jar: participant.jar,
      });
      assert.equal(rejected.status, 400);
    }
    const removed = await call("/update-user", { body: { image: null }, jar: participant.jar });
    assert.equal(removed.status, 200);
    const [cleared] = await db
      .select({ image: schema.users.image })
      .from(schema.users)
      .where(eq(schema.users.id, participant.id));
    assert.equal(cleared?.image, null);
  });
});

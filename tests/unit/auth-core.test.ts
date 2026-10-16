import assert from "node:assert/strict";
import { describe, test } from "vitest";
import { authErrorMessage } from "@/features/auth/domain/auth-errors";
import { formatDateTime, formatRelative, formatSpan } from "@/lib/format";
import { describeUserAgent } from "@/lib/user-agent";
import { emailHash, lockDurationMs } from "@/features/auth/server/lockout.server";
import { hashPassword, verifyPassword } from "@/features/auth/server/password.server";
import { can, statements, type PermissionRequest } from "@/features/auth/server/permissions.server";
import { ADMIN_ROLES, type AdminRole } from "@/features/auth/domain/roles";

describe("password", () => {
  test("argon2id with OWASP parameters, and verification", async () => {
    const hash = await hashPassword("uma-senha-bem-longa");
    assert.match(hash, /^\$argon2id\$v=19\$m=19456,t=2,p=1\$/);
    assert.equal(await verifyPassword({ hash, password: "uma-senha-bem-longa" }), true);
    assert.equal(await verifyPassword({ hash, password: "outra" }), false);
    assert.equal(
      await verifyPassword({ hash: "lixo", password: "x" }),
      false,
      "invalid hash does not throw",
    );
  });
});

describe("lockout after failed attempts", () => {
  test("starts at 15 min on the 5th failure, doubles every 5 and caps at 24 h", () => {
    assert.equal(lockDurationMs(4), 0);
    assert.equal(lockDurationMs(5), 15 * 60_000);
    assert.equal(lockDurationMs(10), 30 * 60_000);
    assert.equal(lockDurationMs(15), 60 * 60_000);
    assert.equal(lockDurationMs(500), 24 * 60 * 60_000);
  });

  test("e-mail hash ignores case/whitespace and separates admin from participant", () => {
    const secret = "segredo-0123456789abcdef0123456789";
    assert.equal(
      emailHash(secret, "admin", " Ana@Exemplo.com "),
      emailHash(secret, "admin", "ana@exemplo.com"),
    );
    assert.notEqual(
      emailHash(secret, "admin", "ana@exemplo.com"),
      emailHash(secret, "user", "ana@exemplo.com"),
    );
    assert.doesNotMatch(emailHash(secret, "admin", "ana@exemplo.com"), /ana/);
  });
});

describe("permission matrix (docs/archive/admin-plan.md §5.2)", () => {
  // Expected per role: allowed [resource, action] pairs. Everything else is denied.
  const expected: Record<AdminRole, string[]> = {
    owner: Object.entries(statements).flatMap(([resource, actions]) =>
      actions.map((action) => `${resource}.${action}`),
    ),
    admin: [
      "user.list",
      "user.get",
      "dashboard.read",
      "participant.read",
      "participant.update",
      "participant.delete",
      "participant.export",
      "room.read",
      "room.update",
      "room.delete",
      "room.export",
      "shareSession.read",
      "shareSession.export",
      "live.read",
      "live.kick",
      "live.close",
      "roomInvite.create",
      "roomInvite.revoke",
      "mail.read",
      "mail.test",
      "report.read",
      "report.resolve",
      "audit.read",
      "settings.read",
      "beta.read",
      "beta.update",
      "lgpd.read",
      "system.status",
    ],
    viewer: ["dashboard.read", "participant.read", "room.read", "shareSession.read", "live.read"],
  };

  for (const role of ADMIN_ROLES) {
    test(`${role}: every catalog action matches the matrix`, () => {
      for (const [resource, actions] of Object.entries(statements)) {
        for (const action of actions) {
          const request = { [resource]: [action] } as PermissionRequest;
          assert.equal(
            can(role, request),
            expected[role].includes(`${resource}.${action}`),
            `${role} ${resource}.${action}`,
          );
        }
      }
    });
  }

  test("nobody impersonates, deletes admins or sets someone else's password", () => {
    for (const role of ADMIN_ROLES) {
      for (const action of ["impersonate", "delete", "set-password", "set-email"]) {
        // Actions outside the catalog: access control denies them.
        assert.equal(
          can(role, { user: [action] } as unknown as PermissionRequest),
          false,
          `${role} user.${action}`,
        );
      }
    }
  });
});

describe("messages and formatting", () => {
  test("login errors do not reveal whether the e-mail exists", () => {
    assert.equal(
      authErrorMessage({ code: "INVALID_EMAIL_OR_PASSWORD", status: 401 }),
      "E-mail ou senha incorretos.",
    );
    assert.equal(
      authErrorMessage({
        code: "SIGN_IN_LOCKED",
        status: 429,
        message: "Muitas tentativas. Tente de novo em 15 min.",
      }),
      "Muitas tentativas. Tente de novo em 15 min.",
    );
    assert.equal(
      authErrorMessage({ status: 429, message: "Too many requests" }),
      "Muitas tentativas. Aguarde um minuto.",
    );
    assert.equal(
      authErrorMessage({ code: "QUALQUER", status: 500 }),
      "Algo deu errado. Tente de novo.",
    );
  });

  test("readable user agent", () => {
    assert.equal(
      describeUserAgent(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36",
      ),
      "Chrome no Windows",
    );
    assert.equal(
      describeUserAgent(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1",
      ),
      "Safari no iOS",
    );
    assert.equal(describeUserAgent(null), "Dispositivo desconhecido");
  });

  test("dates in the São Paulo time zone, including across midnight", () => {
    // 02:30 UTC on 10/07 is still 10/06 in São Paulo (UTC−3).
    assert.equal(formatDateTime("2026-10-07T02:30:00Z"), "06/10/2026, 23:30");
    const now = Date.parse("2026-10-06T12:00:00Z");
    assert.equal(formatRelative(now - 5 * 60_000, now), "há 5 minutos");
    assert.equal(formatRelative(now - 12_000, now), "agora mesmo");
    assert.equal(formatRelative(now - 86_400_000, now), "ontem");
  });

  test("an unparseable date shows a dash instead of throwing", () => {
    assert.equal(formatDateTime("not a date"), "—");
    assert.equal(formatRelative("not a date"), "—");
    assert.equal(formatSpan("not a date", "2026-10-06T12:00:00Z"), "—");
  });
});

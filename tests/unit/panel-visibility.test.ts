import { describe, expect, test } from "vitest";
import { classifyPanelPath } from "@/features/auth/domain/panel-paths";
import {
  ADMIN_PASS_TTL_MS,
  readCookie,
  signAdminPass,
  verifyAdminPass,
} from "@/features/auth/server/admin-pass.server";
import { hiddenPanelUrl } from "@/features/auth/server/panel-visibility.server";

const classify = (path: string, search = "") =>
  classifyPanelPath(path, new URLSearchParams(search));

describe("which requests belong to the panel", () => {
  test("pages, their data requests and the panel API", () => {
    for (const path of [
      "/admin",
      "/admin.data",
      "/admin/entrar",
      "/admin/usuarios/1.data",
      "/api/admin/auth/sign-in/email",
      "/api/admin/exportar/salas",
    ]) {
      expect(classify(path).kind).toBe("panel");
    }
  });

  test("the rest of the site is outside", () => {
    for (const path of ["/", "/inicio", "/administrar", "/api/auth/sign-in/email", "/conta"]) {
      expect(classify(path).kind).toBe("outside");
    }
  });

  test("invitation and new-password links carry their token", () => {
    expect(classify("/admin/convite/abc")).toEqual({ kind: "invitation", token: "abc" });
    expect(classify("/admin/convite/abc.data")).toEqual({ kind: "invitation", token: "abc" });
    expect(classify("/admin/redefinir-senha", "token=xyz")).toEqual({
      kind: "reset",
      token: "xyz",
    });
    expect(classify("/admin/redefinir-senha").kind).toBe("panel");
  });
});

describe("the 30-minute pass", () => {
  const secret = "segredo-do-painel-de-teste-0123456789abcdef";

  test("is valid with the same secret until it expires", () => {
    const now = Date.parse("2026-10-17T12:00:00Z");
    const pass = signAdminPass(secret, now);
    expect(verifyAdminPass(pass, secret, now + ADMIN_PASS_TTL_MS - 1)).toBe(true);
    expect(verifyAdminPass(pass, secret, now + ADMIN_PASS_TTL_MS)).toBe(false);
  });

  test("refuses another secret, a changed expiry and garbage", () => {
    const now = Date.now();
    const pass = signAdminPass(secret, now);
    expect(verifyAdminPass(pass, "outro-segredo-0123456789abcdef0123456789", now)).toBe(false);
    const [, signature] = pass.split(".");
    expect(verifyAdminPass(`${now + 10 * ADMIN_PASS_TTL_MS}.${signature}`, secret, now)).toBe(
      false,
    );
    for (const value of [undefined, "", "abc", "123", "x.y"]) {
      expect(verifyAdminPass(value, secret, now)).toBe(false);
    }
  });

  test("is read from the Cookie header by name", () => {
    const headers = new Headers({ cookie: "a=1; nelcota-admin-pass=v.s; b=2" });
    expect(readCookie(headers, "nelcota-admin-pass")).toBe("v.s");
    expect(readCookie(headers, "outro")).toBeUndefined();
  });
});

test("a hidden request goes to an address that does not exist, losing its query", () => {
  const page = hiddenPanelUrl(new URL("http://site/admin/convite/abc?x=1"));
  expect(page.pathname).toBe("/nao-encontrado");
  expect(page.search).toBe("");
  expect(hiddenPanelUrl(new URL("http://site/admin/usuarios.data")).pathname).toBe(
    "/nao-encontrado.data",
  );
});

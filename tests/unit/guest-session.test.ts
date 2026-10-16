import assert from "node:assert/strict";
import { test, vi } from "vitest";
import { participantName } from "@/features/room/domain/participant-label";
import { newGuestSession, readGuestId } from "@/features/room/server/guest-session.server";

vi.mock("@/server/env.server", () => ({
  getEnv: () => ({ AUTH_SECRET: "segredo-de-teste-com-mais-de-32-caracteres" }),
}));

const withCookie = (cookie: string) =>
  new Request("https://nelcota.app/api/token", { headers: { cookie } });

test("a new guest session is read back from its own signed cookie", async () => {
  const { guestId, setCookie } = await newGuestSession(
    new Request("https://nelcota.app/api/token"),
  );
  assert.match(setCookie, /HttpOnly/);
  assert.match(setCookie, /SameSite=Lax/);
  assert.match(setCookie, /Secure/);
  assert.match(setCookie, /Max-Age=43200/);
  const value = setCookie.split(";")[0] ?? "";
  assert.equal(await readGuestId(withCookie(`outro=1; ${value}`)), guestId);
});

test("a missing, malformed or forged cookie is not a guest", async () => {
  const { setCookie } = await newGuestSession(new Request("https://nelcota.app/api/token"));
  const value = setCookie.split(";")[0] ?? "";
  // Same signature, different payload: the signature no longer matches.
  const [name = "", signed = ""] = value.split("=");
  const forged = `${name}=${encodeURIComponent(btoa(JSON.stringify(crypto.randomUUID())))}.${signed.split(".").at(-1)}`;
  assert.equal(await readGuestId(new Request("https://nelcota.app/api/token")), undefined);
  assert.equal(await readGuestId(withCookie("nelcota_convidado=nao-e-uuid.assinatura")), undefined);
  assert.equal(await readGuestId(withCookie(forged)), undefined);
});

test("guests show up with a marked name; accounts do not", () => {
  assert.equal(participantName({ identity: "convidado-1", name: "Iris" }), "Iris (sem conta)");
  assert.equal(participantName({ identity: "6f1c", name: "Iris" }), "Iris");
  assert.equal(participantName(undefined), "Alguém");
});

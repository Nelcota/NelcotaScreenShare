import { expect, test } from "vitest";
import {
  appendSessionCookies,
  collectSessionCookies,
  sessionWithCookies,
  withResponseCookies,
} from "@/server/response-cookies.server";

function readSession(name: string, value: string) {
  return sessionWithCookies(
    Promise.resolve({
      response: { user: name },
      headers: new Headers({ "Set-Cookie": `${name}=${value}; Path=/; HttpOnly` }),
    }),
  );
}

test("parallel session reads forward both auth instances' cookies without duplicates", async () => {
  const response = await withResponseCookies(async () => {
    await Promise.all([
      readSession("nelcota.session_token", "user"),
      readSession("nelcota-admin.session_token", "admin"),
      readSession("nelcota.session_token", "user"),
    ]);
    return Response.json({ ok: true });
  });
  expect(response.headers.getSetCookie()).toEqual([
    "nelcota.session_token=user; Path=/; HttpOnly",
    "nelcota-admin.session_token=admin; Path=/; HttpOnly",
  ]);
});

test("concurrent requests never receive another caller's cookie", async () => {
  const responses = await Promise.all(
    ["ana", "bia"].map((user) =>
      withResponseCookies(async () => {
        await readSession("session", user);
        await Promise.resolve();
        return new Response();
      }),
    ),
  );
  expect(responses.map((response) => response.headers.getSetCookie())).toEqual([
    ["session=ana; Path=/; HttpOnly"],
    ["session=bia; Path=/; HttpOnly"],
  ]);
});

test("an explicit sign-out or replacement cookie supersedes an earlier refresh", async () => {
  const response = await withResponseCookies(async () => {
    await readSession("session", "old");
    return new Response(null, { headers: { "Set-Cookie": "session=; Max-Age=0; Path=/" } });
  });
  expect(response.headers.getSetCookie()).toEqual(["session=; Max-Age=0; Path=/"]);
});

test("session reads outside HTTP response handling do not leak into later requests", async () => {
  expect(await readSession("session", "outside")).toEqual({ user: "session" });
  const response = await withResponseCookies(async () => new Response());
  expect(response.headers.getSetCookie()).toEqual([]);
});

test("refreshes read before the response exists are handed back and added to it later", async () => {
  const { result, cookies } = await collectSessionCookies(async () => {
    await readSession("nelcota-admin.session_token", "admin");
    await readSession("session", "old");
    return "verdict";
  });
  expect(result).toBe("verdict");
  const response = new Response(null, { headers: { "Set-Cookie": "session=; Max-Age=0; Path=/" } });
  appendSessionCookies(response, cookies);
  expect(response.headers.getSetCookie()).toEqual([
    "session=; Max-Age=0; Path=/",
    "nelcota-admin.session_token=admin; Path=/; HttpOnly",
  ]);
});

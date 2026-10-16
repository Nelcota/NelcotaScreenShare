import { RouterContextProvider } from "react-router";
import { describe, expect, test } from "vitest";
import { loader } from "@/app/routes/access/two-factor";

function load(cookie?: string) {
  const request = new Request("http://localhost:3000/entrar/2fa?voltar=%2Fconta", {
    headers: cookie ? { cookie } : {},
  });
  return Promise.resolve()
    .then(() =>
      loader({
        request,
        params: {},
        context: new RouterContextProvider(),
        url: new URL(request.url),
        pattern: "/entrar/2fa",
      }),
    )
    .catch((thrown: unknown) => thrown);
}

describe("/entrar/2fa", () => {
  test("without a sign-in waiting for the code, goes back to sign-in", async () => {
    const result = await load();
    expect(result).toBeInstanceOf(Response);
    if (!(result instanceof Response)) return;
    expect(result.status).toBe(302);
    expect(result.headers.get("location")).toBe("/entrar?voltar=%2Fconta");
  });

  test.each(["nelcota.two_factor=abc", "__Secure-nelcota.two_factor=abc"])(
    "with the pending sign-in cookie (%s), shows the code form",
    async (cookie) => {
      expect(await load(cookie)).toEqual({ returnTo: "/conta" });
    },
  );
});

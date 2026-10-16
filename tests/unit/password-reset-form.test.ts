import { describe, expect, test } from "vitest";
import { passwordResetFromForm } from "@/features/auth/server/native-auth-actions.server";

function posted(email: string) {
  return new Request("http://localhost:3000/recuperar-senha", {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      origin: "http://localhost:3000",
    },
    body: new URLSearchParams({ email }).toString(),
  });
}

describe("asking for a password link", () => {
  test.each(["", "   ", "ana@", "sem-arroba"])(
    "an empty or malformed e-mail (%j) is answered here and never spends the limit",
    async (email) => {
      let calls = 0;
      const auth = {
        basePath: "/api/auth",
        handle: async () => {
          calls += 1;
          return Response.json({ status: true });
        },
      };
      const result = await passwordResetFromForm(posted(email), auth, {
        redirectTo: "/redefinir-senha",
      });
      expect(calls).toBe(0);
      expect(JSON.stringify(result)).toContain("Digite um e-mail válido.");
    },
  );
});

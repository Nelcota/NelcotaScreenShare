import { describe, expect, test, vi } from "vitest";
import { AUTH_MAX_BODY_BYTES } from "@/features/auth/server/auth-body.server";
import { readAuthForm } from "@/features/auth/server/native-auth-form.server";
import { signInFromForm } from "@/features/auth/server/native-auth-actions.server";

describe("native authentication upload limits", () => {
  test("rejects oversized ignored fields before reaching authentication", async () => {
    const handle = vi.fn();
    const request = new Request("http://localhost/entrar", {
      method: "POST",
      body: new URLSearchParams({
        email: "review@example.com",
        password: "password",
        ignored: "x".repeat(AUTH_MAX_BODY_BYTES),
      }),
    });
    await expect(
      signInFromForm(
        request,
        { handle, basePath: "/api/auth" },
        { done: "/", secondFactor: "/entrar/2fa" },
      ),
    ).rejects.toMatchObject({ status: 413 });
    expect(handle).not.toHaveBeenCalled();
  });

  test("bounds multipart uploads without relying on Content-Length", async () => {
    const body = new FormData();
    body.set("email", "review@example.com");
    body.set("ignored", new Blob(["x".repeat(AUTH_MAX_BODY_BYTES)]), "upload.txt");
    const request = new Request("http://localhost/entrar", { method: "POST", body });
    expect(request.headers.has("content-length")).toBe(false);
    await expect(readAuthForm(request)).rejects.toMatchObject({ status: 413 });
  });

  test("preserves ordinary form fields and rejects malformed bodies", async () => {
    const request = new Request("http://localhost/entrar", {
      method: "POST",
      body: new URLSearchParams({ email: "review@example.com" }),
    });
    expect((await readAuthForm(request)).get("email")).toBe("review@example.com");
    await expect(
      readAuthForm(new Request("http://localhost/entrar", { method: "POST", body: "invalid" })),
    ).rejects.toMatchObject({ status: 400 });
  });
});

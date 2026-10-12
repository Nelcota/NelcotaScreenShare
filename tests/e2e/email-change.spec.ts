import { expect, test } from "@playwright/test";
import { createEmailVerificationToken } from "better-auth/api";
import { z } from "zod";
import { totpFromUri } from "../integration/support/totp";
import { newParticipant, newVisitor, PASSWORD } from "./support/session";

for (const wrongAccount of [false, true]) {
  test(`2FA email-change link resumes through sign-in (${wrongAccount ? "another account" : "signed out"})`, async ({
    browser,
  }) => {
    const account = await newParticipant(browser, "Confirmacao Email");
    await account.page.goto("/conta");
    // Browser fetch sends the Secure cookies on localhost, unlike the raw HTTP test client.
    const enabled = await account.page.evaluate(async (password) => {
      const response = await fetch("/api/auth/two-factor/enable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const body: unknown = await response.json();
      return { status: response.status, body };
    }, PASSWORD);
    expect(enabled.status).toBe(200);
    const setup = z.object({ totpURI: z.string() }).parse(enabled.body);
    const verified = await account.page.evaluate(async (code) => {
      const response = await fetch("/api/auth/two-factor/verify-totp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      return response.status;
    }, totpFromUri(setup.totpURI));
    expect(verified).toBe(200);
    // This is the signed link the mail provider would send; no external delivery is needed.
    const newEmail = `confirmed.${Date.now()}@exemplo.dev`;
    const token = await createEmailVerificationToken(
      "segredo-participantes-e2e-0123456789abcdef0123",
      account.email,
      newEmail,
      86400,
      { requestType: "change-email-verification" },
    );
    const visitor = wrongAccount
      ? await newParticipant(browser, "Outra Conta")
      : await newVisitor(browser);
    const { page, context } = visitor;
    try {
      await page.goto(
        `/api/auth/verify-email?${new URLSearchParams({ token, callbackURL: "/conta?aviso=email" })}`,
      );
      await expect(page).toHaveURL(/\/verificar-email\?token=/);
      await expect(page.getByRole("link", { name: "Confirmar e-mail", exact: true })).toHaveCount(
        0,
      );
      await page
        .getByRole("button", {
          name: wrongAccount ? "Entrar na conta correta" : "Entrar para confirmar",
          exact: true,
        })
        .click();
      await expect(page).toHaveURL(/\/entrar\?voltar=/);
      await page.getByLabel("E-mail").fill(account.email);
      await page.getByLabel("Senha", { exact: true }).fill(PASSWORD);
      await page.getByRole("button", { name: "Entrar", exact: true }).click();
      await expect(page).toHaveURL(/\/entrar\/2fa\?voltar=/);
      await page.getByLabel("Código", { exact: true }).fill(totpFromUri(setup.totpURI));
      await page.getByRole("button", { name: "Verificar", exact: true }).click();
      await expect(page).toHaveURL(/\/verificar-email\?token=/);
      await page.getByRole("link", { name: "Confirmar e-mail", exact: true }).click();
      await expect(page).toHaveURL(/\/conta\?aviso=email$/);
      await expect(page.locator("main header").getByText(newEmail, { exact: true })).toBeVisible();
      const session: unknown = await page.evaluate(async () => {
        const response = await fetch("/api/auth/get-session");
        const body: unknown = await response.json();
        return body;
      });
      expect(
        z
          .object({ user: z.object({ email: z.string(), twoFactorEnabled: z.boolean() }) })
          .parse(session).user,
      ).toEqual({ email: newEmail, twoFactorEnabled: true });
    } finally {
      await context.close();
      await account.context.close();
    }
  });
}

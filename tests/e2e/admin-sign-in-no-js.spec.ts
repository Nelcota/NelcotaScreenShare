import { createHash, randomBytes } from "node:crypto";
import { expect, test } from "@playwright/test";
import { sql } from "./support/database";
import { E2E_URL } from "./support/env";

const PASSWORD = "senha-forte-sem-script";

/** Viewer invitation written straight to the database: no 2FA step for this role. */
async function viewerInvitation(email: string): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  await sql(
    `insert into admin_invitations (email, role, token_hash, expires_at)
     values ($1, 'viewer', $2, now() + interval '30 minutes')`,
    [email, createHash("sha256").update(token).digest("hex")],
  );
  return token;
}

/**
 * The page before hydration, or after a script failed to load: the forms post natively and
 * the route actions answer. Never the "Algo deu errado" screen.
 */
test("admin invitation and sign-in work with JavaScript off", async ({ browser }) => {
  const email = `sem-script.${Date.now()}@exemplo.dev`;
  const token = await viewerInvitation(email);
  const context = await browser.newContext({
    baseURL: E2E_URL,
    locale: "pt-BR",
    javaScriptEnabled: false,
    extraHTTPHeaders: { "x-forwarded-for": "10.78.0.1" },
  });
  const page = await context.newPage();

  await page.goto(`/admin/convite/${token}`);
  await page.getByLabel("Seu nome").fill("Sem Script");
  await page.getByLabel("Senha (pelo menos 12 caracteres)").fill(PASSWORD);
  await page.getByLabel("Repita a senha").fill(PASSWORD);
  await page.getByRole("button", { name: "Criar acesso" }).click();
  await expect(page).toHaveURL(/\/admin\/entrar\?aviso=convite/);

  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha", { exact: true }).fill("senha-errada-sem-script");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/entrar/);
  await expect(page.getByText("E-mail ou senha incorretos.")).toBeVisible();
  await expect(page.getByText("Algo deu errado")).toHaveCount(0);

  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Início");
  await context.close();
});

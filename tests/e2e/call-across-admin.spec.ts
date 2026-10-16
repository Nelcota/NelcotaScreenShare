import { createHash, randomBytes } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { totpFromUri } from "../integration/support/totp";
import { sql } from "./support/database";
import { joinRoom, newParticipant, newRoomCode } from "./support/session";

const ADMIN_PASSWORD = "senha-forte-da-chamada-e2e";

/** A panel owner for this browser, with 2FA on, as the panel requires. */
async function openPanelAsOwner(page: Page) {
  const email = `dona.chamada.${Date.now()}@exemplo.dev`;
  const token = randomBytes(32).toString("base64url");
  await sql(
    `insert into admin_invitations (email, role, token_hash, expires_at)
     values ($1, 'owner', $2, now() + interval '30 minutes')`,
    [email, createHash("sha256").update(token).digest("hex")],
  );
  await page.goto(`/admin/convite/${token}`);
  await page.getByLabel("Seu nome").fill("Dona da Chamada");
  await page.getByLabel("Senha (pelo menos 12 caracteres)").fill(ADMIN_PASSWORD);
  await page.getByLabel("Repita a senha").fill(ADMIN_PASSWORD);
  await page.getByRole("button", { name: "Criar acesso" }).click();
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha", { exact: true }).fill(ADMIN_PASSWORD);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await page.getByLabel("Confirme sua senha").fill(ADMIN_PASSWORD);
  await page.getByRole("button", { name: "Ativar verificação" }).click();
  const secret = (await page.locator("code").first().textContent())?.trim() ?? "";
  await page
    .getByLabel("Código do app")
    .fill(totpFromUri(`otpauth://totp/Nelcota?secret=${secret}`));
  await page.getByRole("button", { name: "Confirmar e ativar" }).click();
  await page.getByRole("button", { name: "Guardei os códigos" }).click();
}

test("a call goes on minimized through the admin panel and back, without reloading", async ({
  browser,
}) => {
  const { page, context } = await newParticipant(browser, "Dona Na Chamada");
  try {
    await openPanelAsOwner(page);
    await joinRoom(page, await newRoomCode(), { micOn: false });
    // A full page load would drop this mark, and the call with it.
    await page.evaluate(() => Object.assign(window, { sameDocument: true }));
    const card = page.getByRole("complementary", { name: "Chamada em andamento" });

    await page.getByRole("link", { name: "Abrir o painel admin" }).click();
    await expect(page).toHaveURL(/\/admin$/);
    await expect(card).toBeVisible();

    await page.locator('a[href="/admin/usuarios"]:visible').first().click();
    await expect(page).toHaveURL(/\/admin\/usuarios/);
    await expect(card).toBeVisible();

    await page.getByRole("link", { name: "Voltar ao app" }).click();
    await expect(page).not.toHaveURL(/\/admin/);
    await expect(card).toBeVisible();

    await card.getByRole("link", { name: "Voltar à chamada" }).click();
    await expect(page.getByRole("button", { name: /Sair/ }).first()).toBeVisible();
    expect(await page.evaluate(() => "sameDocument" in window)).toBe(true);
  } finally {
    await context.close();
  }
});

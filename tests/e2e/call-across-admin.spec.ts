import { createHash, randomBytes } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { totpFromUri } from "../integration/support/totp";
import { sql } from "./support/database";
import { joinRoom, newParticipant, newRoomCode } from "./support/session";

const ADMIN_PASSWORD = "senha-forte-da-chamada-e2e";

/**
 * A panel owner for this browser, with 2FA on, as the panel requires; signed in to the panel.
 * Returns the authenticator URI, to make more codes later.
 */
async function openPanelAsOwner(
  page: Page,
  email = `dona.chamada.${Date.now()}@exemplo.dev`,
): Promise<string> {
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
  const uri = `otpauth://totp/Nelcota?secret=${secret}`;
  await page.getByLabel("Código do app").fill(totpFromUri(uri));
  await page.getByRole("button", { name: "Confirmar e ativar" }).click();
  await page.getByRole("button", { name: "Guardei os códigos" }).click();
  return uri;
}

/** A code from the next 30 s window: the one used to turn 2FA on cannot be used again. */
async function freshCode(page: Page, uri: string): Promise<string> {
  const untilNextWindow = 30_000 - (Date.now() % 30_000);
  await page.waitForTimeout(untilNextWindow + 1_000);
  return totpFromUri(uri);
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

test("someone on the team signs in to the panel from Configurações during a call, 2FA included", async ({
  browser,
}) => {
  test.setTimeout(120_000);
  const member = await newParticipant(browser, "Membro Na Chamada");
  const { page, context } = member;
  try {
    // On the team: the app account has the verified e-mail of a panel account.
    await sql("update users set email_verified = true where email = $1", [member.email]);
    const uri = await openPanelAsOwner(page, member.email);
    // Out of the panel again, keeping the app account: the call starts without a panel session.
    const appCookies = (await context.cookies()).filter((cookie) => !cookie.name.includes("admin"));
    await context.clearCookies();
    await context.addCookies(appCookies);

    await joinRoom(page, await newRoomCode(), { micOn: false });
    // A full page load would drop this mark, and the call with it.
    await page.evaluate(() => Object.assign(window, { sameDocument: true }));
    const card = page.getByRole("complementary", { name: "Chamada em andamento" });

    await page.getByRole("button", { name: "Mais opções", exact: true }).click();
    await page
      .getByRole("dialog")
      .getByRole("link", { name: "Configurações", exact: true })
      .click();
    await page.getByRole("link", { name: "Abrir o painel" }).click();
    await expect(page).toHaveURL(/\/admin\/entrar/);
    await expect(card).toBeVisible();

    // The link moves with a view transition: the address changes before Configurações leaves,
    // so wait for the panel's own e-mail field.
    await page.getByRole("textbox", { name: "E-mail", exact: true }).fill(member.email);
    await page.getByLabel("Senha", { exact: true }).fill(ADMIN_PASSWORD);
    await page.getByRole("button", { name: "Entrar", exact: true }).click();
    await expect(page).toHaveURL(/\/admin\/verificar-2fa/);
    await expect(card).toBeVisible();

    await page.getByLabel("Código", { exact: true }).fill(await freshCode(page, uri));
    await page.getByRole("button", { name: "Verificar", exact: true }).click();
    await expect(page).toHaveURL(/\/admin$/);
    await expect(card).toBeVisible();

    await card.getByRole("link", { name: "Voltar à chamada" }).click();
    await expect(page.getByRole("button", { name: /Sair/ }).first()).toBeVisible();
    expect(await page.evaluate(() => "sameDocument" in window)).toBe(true);
  } finally {
    await context.close();
  }
});

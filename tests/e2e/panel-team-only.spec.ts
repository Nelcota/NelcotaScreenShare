import { expect, test } from "@playwright/test";
import { sql } from "./support/database";
import { newParticipant, newVisitor } from "./support/session";

const NOT_FOUND_TITLE = "Página não encontrada · Nelcota";

test("the admin panel exists only for its team, like any wrong address for everyone else", async ({
  browser,
}) => {
  // A visitor gets the site's 404, the same as for an address that does not exist.
  const visitor = await newVisitor(browser);
  for (const path of ["/admin", "/admin/entrar", "/ADMIN/entrar", "/%61dmin/entrar"]) {
    const response = await visitor.page.goto(path);
    expect(response?.status(), path).toBe(404);
    await expect(visitor.page).toHaveTitle(NOT_FOUND_TITLE);
  }

  // Someone on the team: the app account has the same verified e-mail as a panel account.
  const member = await newParticipant(browser, "Membro Equipe");
  // E-mail confirmation is off in E2E, so the address is marked as confirmed here.
  await sql("update users set email_verified = true where email = $1", [member.email]);
  await sql("insert into admin_users (name, email, role) values ($1, $2, 'admin')", [
    "Membro Equipe",
    member.email.toUpperCase(),
  ]);
  await member.page.goto("/conta");
  await member.page.getByRole("link", { name: "Abrir o painel", exact: true }).click();
  await expect(member.page).toHaveURL(/\/admin\/entrar/);
  await expect(member.page.getByRole("heading", { name: "Entrar no painel" })).toBeVisible();

  // Anyone else signed in: no link in Configurações, and the panel is a 404.
  const outsider = await newParticipant(browser, "Fora Equipe");
  await outsider.page.goto("/conta");
  await expect(outsider.page.getByRole("link", { name: "Abrir o painel" })).toHaveCount(0);
  const hidden = await outsider.page.goto("/admin/entrar");
  expect(hidden?.status()).toBe(404);
  await expect(outsider.page).toHaveTitle(NOT_FOUND_TITLE);

  // Deactivated in Equipe: the link disappears.
  await sql("update admin_users set banned = true where lower(email) = lower($1)", [member.email]);
  await member.page.goto("/conta");
  await expect(member.page.getByRole("link", { name: "Abrir o painel" })).toHaveCount(0);
});

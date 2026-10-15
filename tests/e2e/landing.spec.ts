import { expect, test } from "@playwright/test";
import { newVisitor } from "./support/session";

test("home: a visitor creating a room signs up first; the Pro list takes an e-mail", async ({
  browser,
}) => {
  const { page, context } = await newVisitor(browser);
  await page.goto("/");
  await page.getByRole("button", { name: "Criar sala", exact: true }).first().click();
  await expect(page).toHaveURL(/\/cadastro\?voltar=%2F%3Fcriar%3Dsala$/);

  await page.goto("/#precos");
  const pricing = page.getByRole("region", { name: "Preços" });
  await pricing.getByLabel("Quer ser avisado quando o Pro abrir?").fill("sem-arroba");
  await pricing.getByRole("button", { name: "Quero ser avisado" }).click();
  await expect(pricing.getByText(/Confira o e-mail/)).toBeVisible();
  await pricing
    .getByLabel("Quer ser avisado quando o Pro abrir?")
    .fill(`pro.${Date.now()}@exemplo.dev`);
  await pricing.getByRole("button", { name: "Quero ser avisado" }).click();
  await expect(pricing.getByText("Pronto! Avisamos por e-mail quando o Pro abrir.")).toBeVisible();
  await context.close();
});

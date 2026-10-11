import { expect, test } from "@playwright/test";
import { joinRoom, newParticipant, newRoomCode, newVisitor } from "./support/session";
import { E2E_ACCESS_PASSWORD } from "./support/env";

test("edit the profile during a call and return without joining again", async ({ browser }) => {
  const { page, context } = await newParticipant(browser, "Perfil Sala");
  const code = newRoomCode();
  await joinRoom(page, code);
  await page.getByRole("button", { name: "Mais opções", exact: true }).click();
  await page.getByLabel("Seu nome na sala", { exact: true }).fill("Nome Durante Chamada");
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(
    page.getByText("Nome atualizado para todos na sala.", { exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: /Foto, e-mail e senha na sua conta/ }).click();
  await expect(page).toHaveURL(new RegExp(`/conta\\?voltar=%2Fsala%2F${code}$`));
  await expect(page.getByLabel("Seu nome na sala", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("complementary", { name: "Chamada em andamento" })).toBeVisible();
  await page.getByLabel("Nome na sala").fill("Perfil Atualizado");
  await page.getByRole("button", { name: "Salvar", exact: true }).click();
  await expect(page.getByLabel("Nome na sala")).toHaveValue("Perfil Atualizado");
  await page.getByRole("link", { name: "Voltar para a sala", exact: true }).click();
  await expect(page.getByRole("button", { name: /Desligar microfone/ })).toBeVisible();
  await expect(page.getByLabel("Senha da sala (quem te convidou sabe)")).toHaveCount(0);
  await context.close();
});

test("a guest's mobile rename reaches others and is remembered for the next invite", async ({
  browser,
}) => {
  const observer = await newParticipant(browser, "Nome Observador");
  const guest = await newVisitor(browser);
  try {
    const code = newRoomCode();
    await joinRoom(observer.page, code, { micOn: false });
    await guest.page.setViewportSize({ width: 390, height: 844 });
    await guest.page.goto(`/sala/${code}`);
    await guest.page.getByLabel("Seu nome na sala", { exact: true }).fill("Visitante Original");
    await guest.page.getByRole("switch").first().click();
    await guest.page.getByLabel("Senha da sala (quem te convidou sabe)").fill(E2E_ACCESS_PASSWORD);
    await guest.page.getByRole("button", { name: "Entrar só ouvindo", exact: true }).click();
    await expect(
      guest.page.getByRole("button", { name: "Sair da sala", exact: true }),
    ).toBeVisible();
    await guest.page.getByRole("button", { name: "Mais opções", exact: true }).click();
    await guest.page.getByLabel("Seu nome na sala", { exact: true }).fill("Visitante Renomeado");
    await guest.page.getByRole("button", { name: "Salvar", exact: true }).click();
    await expect(
      observer.page.getByText("Visitante Renomeado (convidado)", { exact: true }),
    ).toBeVisible();
    await expect(
      observer.page.getByText("Visitante Original (convidado)", { exact: true }),
    ).toBeHidden();
    await guest.page.keyboard.press("Escape");
    await guest.page.getByRole("button", { name: "Sair da sala", exact: true }).click();
    await guest.page
      .getByRole("alertdialog")
      .getByRole("button", { name: "Sair", exact: true })
      .click();
    await guest.page.goto(`/sala/${newRoomCode()}`);
    await expect(guest.page.getByLabel("Seu nome na sala", { exact: true })).toHaveValue(
      "Visitante Renomeado",
    );
  } finally {
    await guest.context.close();
    await observer.context.close();
  }
});

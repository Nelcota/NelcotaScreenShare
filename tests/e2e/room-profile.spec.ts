import { expect, test } from "@playwright/test";
import { joinRoom, newParticipant, newRoomCode } from "./support/session";

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

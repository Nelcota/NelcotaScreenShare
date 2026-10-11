import { expect, test } from "@playwright/test";
import { joinRoom, newParticipant, newRoomCode } from "./support/session";

test("streamer mode hides every invitation and can reveal them again", async ({ browser }) => {
  const { page, context } = await newParticipant(browser, "Streamer Teste");
  const code = newRoomCode();
  await joinRoom(page, code, { micOn: false });
  await expect(page.getByLabel("Link da sala", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Mais opções", exact: true }).click();
  await page.getByRole("switch", { name: "Modo streamer" }).click();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "Código oculto. Copiar link para convidar" }),
  ).toBeVisible();
  await expect(page.getByLabel("Link da sala", { exact: true })).toHaveCount(0);
  await expect(page.getByLabel("QR code para entrar na sala pelo celular")).toHaveCount(0);
  expect(await page.locator("body").innerText()).not.toContain(code);
  await page.getByRole("button", { name: "Sair da sala", exact: true }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Sair", exact: true }).click();
  await expect(page.getByText("Você saiu da sala", { exact: true })).toBeVisible();
  expect(await page.locator("body").innerText()).not.toContain(code);
  await expect(page.getByRole("button", { name: "Copiar link", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Voltar para a sala", exact: true }).click();
  await expect(page.getByRole("button", { name: "Copiar convite", exact: true })).toHaveCount(0);
  await page.reload();
  await expect(
    page.getByRole("button", { name: /Entrar na sala|Entrar só ouvindo/ }),
  ).toBeEnabled();
  await expect(page.getByRole("button", { name: "Copiar convite", exact: true })).toHaveCount(0);
  expect(await page.locator("body").innerText()).not.toContain(code);
  await joinRoom(page, code, { micOn: false });
  await expect(page.getByLabel("Link da sala", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Mais opções", exact: true }).click();
  await expect(page.getByRole("switch", { name: "Modo streamer" })).toBeChecked();
  await page.getByRole("switch", { name: "Modo streamer" }).click();
  await page.keyboard.press("Escape");
  await expect(page.getByLabel("Link da sala", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: `Sala ${code}. Copiar link para convidar` }),
  ).toBeVisible();
  await context.close();
});

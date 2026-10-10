import { expect, test } from "@playwright/test";
import { joinRoom, newParticipant, newRoomCode } from "./support/session";

test("turning off shortcuts leaves gameplay keys free and call buttons usable", async ({
  browser,
}) => {
  const { page, context } = await newParticipant(browser, "Atalhos Teste");
  try {
    await joinRoom(page, newRoomCode(), { micOn: false });
    const dock = page.getByRole("navigation", { name: "Controles da chamada", exact: true });
    const chatInput = page.getByPlaceholder("Escreva para a sala", { exact: true });
    await page.keyboard.press("c");
    await expect(chatInput).toBeVisible();
    await page.getByRole("button", { name: "Fechar chat", exact: true }).click();

    const options = page.getByRole("button", { name: "Mais opções", exact: true });
    await options.click();
    const shortcuts = page.getByRole("switch", { name: "Atalhos na sala", exact: true });
    await expect(shortcuts).toBeChecked();
    await shortcuts.click();
    await expect(shortcuts).not.toBeChecked();
    await options.click();
    await expect(page.getByRole("dialog", { name: "Mais opções", exact: true })).toBeHidden();

    for (const key of ["m", "c", "s", "h", "e"]) await page.keyboard.press(key);
    await expect(dock.getByRole("button", { name: "Ligar microfone", exact: true })).toBeVisible();
    await expect(chatInput).toBeHidden();
    await expect(page.getByRole("dialog")).toBeHidden();
    await expect(
      page.getByRole("alertdialog", { name: "Sair da sala?", exact: true }),
    ).toBeHidden();
    await expect(dock.getByRole("button", { name: "Reações", exact: true })).toBeVisible();
    await dock.getByRole("button", { name: "Chat", exact: true }).click();
    await expect(chatInput).toBeVisible();
    await page.getByRole("button", { name: "Fechar chat", exact: true }).click();

    await options.click();
    await expect(shortcuts).not.toBeChecked();
    await shortcuts.click();
    await options.click();
    await expect(page.getByRole("dialog", { name: "Mais opções", exact: true })).toBeHidden();
    await page.keyboard.press("c");
    await expect(chatInput).toBeVisible();
  } finally {
    await context.close();
  }
});

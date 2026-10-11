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

    await page.setViewportSize({ width: 390, height: 844 });
    const options = page.getByRole("button", { name: "Mais opções", exact: true });
    await options.click();
    const shortcuts = page.getByRole("switch", { name: "Atalhos na sala", exact: true });
    await expect(shortcuts).toBeChecked();
    await shortcuts.click();
    await expect(shortcuts).not.toBeChecked();
    await options.click();
    await expect(page.getByRole("dialog", { name: "Mais opções", exact: true })).toBeHidden();
    await page.setViewportSize({ width: 1280, height: 720 });

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

test("typing and modified or repeated keys do not toggle the microphone", async ({ browser }) => {
  const { page, context } = await newParticipant(browser, "Atalhos Campos");
  try {
    await joinRoom(page, newRoomCode(), { micOn: false });
    const microphoneOff = page.getByRole("button", { name: "Ligar microfone", exact: true });
    await page.keyboard.press("c");
    const input = page.getByPlaceholder("Escreva para a sala", { exact: true });
    await input.click();
    await page.keyboard.type("mchs");
    await expect(input).toHaveValue("mchs");
    await expect(microphoneOff).toBeVisible();
    await page.getByRole("button", { name: "Fechar chat", exact: true }).click();
    const prevented = await page.evaluate(() => {
      return [{ ctrlKey: true }, { metaKey: true }, { altKey: true }, { repeat: true }].map(
        (modifiers) => {
          const event = new KeyboardEvent("keydown", {
            key: "m",
            bubbles: true,
            cancelable: true,
            ...modifiers,
          });
          window.dispatchEvent(event);
          return event.defaultPrevented;
        },
      );
    });
    expect(prevented).toEqual([false, false, false, false]);
    await expect(microphoneOff).toBeVisible();
    await page.keyboard.press("m");
    await expect(
      page.getByRole("button", { name: "Desligar microfone", exact: true }),
    ).toBeVisible();
  } finally {
    await context.close();
  }
});

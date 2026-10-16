import { expect, test } from "@playwright/test";
import { joinRoom, newParticipant, newRoomCode } from "./support/session";

test("turning off shortcuts leaves gameplay keys free and call buttons usable", async ({
  browser,
}) => {
  const { page, context } = await newParticipant(browser, "Atalhos Teste");
  try {
    await joinRoom(page, await newRoomCode(), { micOn: false });
    const dock = page.getByRole("navigation", { name: "Controles da chamada", exact: true });
    const chatInput = page.getByPlaceholder("Escreva para a sala", { exact: true });
    await page.keyboard.press("c");
    await expect(chatInput).toBeVisible();
    await page.getByRole("button", { name: "Fechar chat", exact: true }).click();

    const help = page.getByRole("dialog", { name: "Atalhos de teclado", exact: true });
    await page.keyboard.press("Shift+Slash");
    await expect(help).toBeVisible();
    await expect(help.getByText("Esta ajuda", { exact: true })).toBeVisible();
    // Keys pressed inside the dialog belong to it: the chat stays closed behind it.
    await page.keyboard.press("c");
    await expect(chatInput).toBeHidden();
    await page.keyboard.press("Escape");
    await expect(help).toBeHidden();

    const helpButton = page.getByRole("button", { name: "Atalhos de teclado", exact: true });
    await helpButton.click();
    const shortcuts = help.getByRole("switch", { name: "Atalhos na sala", exact: true });
    await expect(shortcuts).toBeChecked();
    await shortcuts.click();
    await expect(shortcuts).not.toBeChecked();
    await help.getByRole("button", { name: "Entendi", exact: true }).click();
    await expect(help).toBeHidden();

    for (const key of ["m", "c", "s", "h", "e", "?"]) await page.keyboard.press(key);
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

    await helpButton.click();
    await expect(shortcuts).not.toBeChecked();
    await shortcuts.click();
    await page.keyboard.press("Escape");
    await expect(help).toBeHidden();
    await page.keyboard.press("c");
    await expect(chatInput).toBeVisible();
  } finally {
    await context.close();
  }
});

test("typing and modified or repeated keys do not toggle the microphone", async ({ browser }) => {
  const { page, context } = await newParticipant(browser, "Atalhos Campos");
  try {
    await joinRoom(page, await newRoomCode(), { micOn: false });
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

test("a shortcut gets another key, refuses browser keys and keeps the choice", async ({
  browser,
}) => {
  const { page, context } = await newParticipant(browser, "Atalhos Troca");
  try {
    await joinRoom(page, await newRoomCode(), { micOn: false });
    const microphoneOff = page.getByRole("button", { name: "Ligar microfone", exact: true });
    const microphoneOn = page.getByRole("button", { name: "Desligar microfone", exact: true });
    const help = page.getByRole("dialog", { name: "Atalhos de teclado", exact: true });
    const micKey = help.getByRole("button", { name: /Liga e desliga o microfone/ });

    await page.getByRole("button", { name: "Atalhos de teclado", exact: true }).click();
    await expect(help.getByText("Clique numa tecla para trocar.", { exact: true })).toBeVisible();
    await micKey.click();
    await expect(help.getByText("Aperte a nova tecla.", { exact: true })).toBeVisible();

    await page.keyboard.press("Alt+F4");
    await expect(help.getByRole("alert")).toHaveText("Use uma tecla só, sem Ctrl, Alt ou Cmd.");
    await page.keyboard.press("ArrowUp");
    await expect(help.getByRole("alert")).toHaveText("Escolha uma letra ou um número.");
    await page.keyboard.press("c");
    await expect(help.getByRole("alert")).toHaveText("Essa tecla já é de “Abre e fecha o chat”.");

    await page.keyboard.press("k");
    await expect(micKey).toHaveText("K");
    await page.keyboard.press("Escape");
    await expect(help).toBeHidden();
    await expect(page.getByPlaceholder("Escreva para a sala", { exact: true })).toBeHidden();

    await expect(microphoneOff).toHaveAttribute("aria-keyshortcuts", "K");
    await page.keyboard.press("m");
    await expect(microphoneOff).toBeVisible();
    await page.keyboard.press("k");
    await expect(microphoneOn).toBeVisible();

    await joinRoom(page, await newRoomCode(), { micOn: false });
    await page.keyboard.press("k");
    await expect(microphoneOn).toBeVisible();

    await page.getByRole("button", { name: "Atalhos de teclado", exact: true }).click();
    await help.getByRole("button", { name: "Restaurar padrão", exact: true }).click();
    await expect(micKey).toHaveText("M");
  } finally {
    await context.close();
  }
});

test("after picking a reaction, H still raises the hand", async ({ browser }) => {
  const { page, context } = await newParticipant(browser, "Atalho Mao");
  try {
    await joinRoom(page, await newRoomCode(), { micOn: false });
    await page.getByRole("button", { name: "Reações" }).click();
    await page.getByRole("button", { name: "Reagir com 🎉" }).click();
    // Closed, the menu stays in the page with the focus on the reaction; its keys go back to
    // the room.
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog", { name: "Reações" })).toBeHidden();
    await page.keyboard.press("h");
    await expect(page.getByText("✋ Você levantou a mão")).toBeVisible();
  } finally {
    await context.close();
  }
});

import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { chatPair } from "./support/chat";

const NOTES = ["Anotações da reunião", "Ver https://exemplo.com/painel", "Prazo: sexta"].join("\n");

test("a .txt waits in the box and goes with the text; the others see its first lines and save it", async ({
  browser,
}) => {
  const { sender, receiver, senderChat, receiverChat } = await chatPair(browser, [
    "Manda Texto",
    "Le Texto",
  ]);
  try {
    await senderChat
      .locator('input[type="file"]')
      .setInputFiles({ name: "reunião.txt", mimeType: "text/plain", buffer: Buffer.from(NOTES) });
    await expect(senderChat.getByLabel("Arquivo anexado: reunião.txt")).toBeVisible();
    await sender.page.getByPlaceholder("Escreva para a sala").fill("Segue o resumo");
    await sender.page.keyboard.press("Enter");

    const message = receiverChat.getByRole("listitem").filter({ hasText: "Segue o resumo" });
    const preview = message.getByLabel("Começo de reunião.txt");
    await expect(preview).toContainText("Prazo: sexta");
    // A link inside the text stays text: nothing to click there.
    await expect(message.getByRole("link")).toHaveCount(0);

    const download = receiver.page.waitForEvent("download");
    await message.getByRole("button", { name: "Baixar" }).click();
    const saved = await download;
    expect(saved.suggestedFilename()).toBe("reunião.txt");
    const path = await saved.path();
    expect(await readFile(path, "utf8")).toBe(NOTES);
  } finally {
    await sender.context.close();
    await receiver.context.close();
  }
});

test("a program renamed to .txt is refused before it goes", async ({ browser }) => {
  const { sender, receiver, senderChat } = await chatPair(browser, [
    "Manda Programa",
    "Nao Recebe",
  ]);
  try {
    await senderChat.locator('input[type="file"]').setInputFiles({
      name: "leia.txt",
      mimeType: "text/plain",
      buffer: Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0xff, 0xfe, 0x00, 0x01]),
    });
    await expect(sender.page.getByText("Esse arquivo não é texto simples.")).toBeVisible();
    await expect(senderChat.getByLabel(/Arquivo anexado/)).toHaveCount(0);
  } finally {
    await sender.context.close();
    await receiver.context.close();
  }
});

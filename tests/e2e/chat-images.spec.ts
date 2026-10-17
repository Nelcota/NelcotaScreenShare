import { expect, test } from "@playwright/test";
import { joinRoom, newParticipant, newRoomCode } from "./support/session";

/** A tiny real PNG (1×1, green), as a print would be. */
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);

test("an image sent in the call chat reaches the others, and a non-image is refused", async ({
  browser,
}) => {
  const sender = await newParticipant(browser, "Manda Print");
  const receiver = await newParticipant(browser, "Ve Print");
  try {
    const code = await newRoomCode();
    await joinRoom(sender.page, code, { micOn: false });
    await joinRoom(receiver.page, code, { micOn: false });
    await sender.page.getByRole("button", { name: /^Chat/ }).click();
    await receiver.page.getByRole("button", { name: /^Chat/ }).click();
    const senderChat = sender.page.getByRole("complementary", { name: "Chat da sala" });
    const receiverChat = receiver.page.getByRole("complementary", { name: "Chat da sala" });

    await senderChat
      .locator('input[type="file"]')
      .setInputFiles({ name: "print.png", mimeType: "image/png", buffer: PNG });
    await expect(senderChat.getByRole("img", { name: "Imagem: print.png" })).toBeVisible();
    await expect(receiverChat.getByRole("img", { name: "Imagem: print.png" })).toBeVisible();
    await expect(
      receiverChat.getByRole("link", { name: "Abrir a imagem de Manda Print" }),
    ).toHaveAttribute("href", /^blob:/);

    await senderChat
      .locator('input[type="file"]')
      .setInputFiles({ name: "notas.txt", mimeType: "text/plain", buffer: Buffer.from("oi") });
    await expect(sender.page.getByText("Envie só imagens: PNG, JPG, WebP ou GIF.")).toBeVisible();
  } finally {
    await sender.context.close();
    await receiver.context.close();
  }
});

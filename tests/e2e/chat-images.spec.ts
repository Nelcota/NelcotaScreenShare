import { expect, test, type Locator, type Page } from "@playwright/test";
import { joinRoom, newParticipant, newRoomCode } from "./support/session";

/** A tiny real PNG (1×1, green), as a print would be. */
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);

/** Two people in one call with the chat open on both sides. */
async function chatPair(browser: Parameters<typeof newParticipant>[0], names: [string, string]) {
  const sender = await newParticipant(browser, names[0]);
  const receiver = await newParticipant(browser, names[1]);
  const code = await newRoomCode();
  await joinRoom(sender.page, code, { micOn: false });
  await joinRoom(receiver.page, code, { micOn: false });
  await sender.page.getByRole("button", { name: /^Chat/ }).click();
  await receiver.page.getByRole("button", { name: /^Chat/ }).click();
  return {
    sender,
    receiver,
    senderChat: sender.page.getByRole("complementary", { name: "Chat da sala" }),
    receiverChat: receiver.page.getByRole("complementary", { name: "Chat da sala" }),
  };
}

/** A file dropped on the chat from the computer, as a drag from the desktop sends it. */
async function dropImage(page: Page, target: Locator, name: string) {
  const transfer = await page.evaluateHandle(
    ({ bytes, fileName }) => {
      const data = new DataTransfer();
      data.items.add(new File([new Uint8Array(bytes)], fileName, { type: "image/png" }));
      return data;
    },
    { bytes: [...PNG], fileName: name },
  );
  await target.dispatchEvent("dragover", { dataTransfer: transfer });
  await target.dispatchEvent("drop", { dataTransfer: transfer });
}

/** A print pasted into the message box, as Ctrl+V does with an image in the clipboard. */
async function pasteImage(page: Page, name: string) {
  await page.getByPlaceholder("Escreva para a sala").evaluate(
    (box, { bytes, fileName }) => {
      const data = new DataTransfer();
      data.items.add(new File([new Uint8Array(bytes)], fileName, { type: "image/png" }));
      box.dispatchEvent(new ClipboardEvent("paste", { clipboardData: data, bubbles: true }));
    },
    { bytes: [...PNG], fileName: name },
  );
}

test("an image waits in the box and goes with the text as one message; a non-image is refused", async ({
  browser,
}) => {
  const { sender, receiver, senderChat, receiverChat } = await chatPair(browser, [
    "Manda Print",
    "Ve Print",
  ]);
  try {
    await senderChat
      .locator('input[type="file"]')
      .setInputFiles({ name: "print.png", mimeType: "image/png", buffer: PNG });
    // Picked, it waits with a preview: nothing goes before Enter.
    await expect(senderChat.getByRole("img", { name: "Imagem anexada: print.png" })).toBeVisible();
    await expect(receiverChat.getByRole("img", { name: "Imagem: print.png" })).toHaveCount(0);

    await sender.page.getByPlaceholder("Escreva para a sala").fill("Olha o erro");
    await sender.page.keyboard.press("Enter");
    await expect(receiverChat.getByRole("img", { name: "Imagem: print.png" })).toBeVisible();
    const message = receiverChat.getByRole("listitem").filter({ hasText: "Olha o erro" });
    await expect(message.getByRole("img", { name: "Imagem: print.png" })).toBeVisible();
    await expect(
      receiverChat.getByRole("link", { name: "Abrir a imagem de Manda Print" }),
    ).toHaveAttribute("href", /^blob:/);
    await expect(senderChat.getByRole("img", { name: "Imagem anexada: print.png" })).toHaveCount(0);
    await expect(sender.page.getByPlaceholder("Escreva para a sala")).toHaveValue("");

    await senderChat
      .locator('input[type="file"]')
      .setInputFiles({ name: "notas.txt", mimeType: "text/plain", buffer: Buffer.from("oi") });
    await expect(sender.page.getByText("Envie só imagens: PNG, JPG, WebP ou GIF.")).toBeVisible();
    await expect(senderChat.getByRole("img", { name: /Imagem anexada/ })).toHaveCount(0);
  } finally {
    await sender.context.close();
    await receiver.context.close();
  }
});

test("an image dragged from the computer or pasted waits in the box, and can be taken out", async ({
  browser,
}) => {
  const { sender, receiver, senderChat, receiverChat } = await chatPair(browser, [
    "Arrasta Print",
    "Recebe Print",
  ]);
  try {
    await dropImage(sender.page, senderChat, "arrastada.png");
    await expect(
      senderChat.getByRole("img", { name: "Imagem anexada: arrastada.png" }),
    ).toBeVisible();
    await senderChat.getByRole("button", { name: "Tirar a imagem" }).click();
    await expect(senderChat.getByRole("img", { name: /Imagem anexada/ })).toHaveCount(0);

    await pasteImage(sender.page, "colada.png");
    await expect(senderChat.getByRole("img", { name: "Imagem anexada: colada.png" })).toBeVisible();
    // An image alone goes too.
    await sender.page.getByPlaceholder("Escreva para a sala").press("Enter");
    await expect(receiverChat.getByRole("img", { name: "Imagem: colada.png" })).toBeVisible();
    await expect(receiverChat.getByRole("img", { name: "Imagem: arrastada.png" })).toHaveCount(0);
  } finally {
    await sender.context.close();
    await receiver.context.close();
  }
});

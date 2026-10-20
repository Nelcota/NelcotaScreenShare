import { expect, test, type Locator, type Page } from "@playwright/test";
import { joinRoom, newParticipant, newRoomCode } from "./support/session";

/** A tiny real PNG (1×1, green), as a print would be. */
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);

/** Two people in one call with the chat open on both sides. */
async function chatPair(
  browser: Parameters<typeof newParticipant>[0],
  names: [string, string],
  { recordBlobs = false } = {},
) {
  const sender = await newParticipant(browser, names[0]);
  const receiver = await newParticipant(browser, names[1]);
  // What the receiver builds from the bytes that arrived (the page's CSP blocks fetching blobs).
  if (recordBlobs) {
    await receiver.page.addInitScript(() => {
      const made: { size: number; type: string }[] = [];
      Object.assign(window, { madeBlobs: made });
      const original = URL.createObjectURL.bind(URL);
      URL.createObjectURL = (object: Blob | MediaSource) => {
        if (object instanceof Blob) made.push({ size: object.size, type: object.type });
        return original(object);
      };
    });
  }
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

test("a picture over 5 MB is reduced in the browser, and what arrives is within 5 MB", async ({
  browser,
}) => {
  const { sender, receiver, senderChat, receiverChat } = await chatPair(
    browser,
    ["Foto Grande", "Ve Foto"],
    { recordBlobs: true },
  );
  try {
    // A 3000×2000 photo-like picture (noisy, so it does not compress), handed to the picker.
    const pickedBytes = await senderChat.locator('input[type="file"]').evaluate(async (input) => {
      const canvas = document.createElement("canvas");
      canvas.width = 3000;
      canvas.height = 2000;
      const context = canvas.getContext("2d");
      if (!context || !(input instanceof HTMLInputElement)) throw new Error("No canvas");
      const pixels = context.createImageData(canvas.width, canvas.height);
      for (let index = 0; index < pixels.data.length; index += 4) {
        pixels.data[index] = (index * 7) % 251;
        pixels.data[index + 1] = Math.floor(Math.random() * 256);
        pixels.data[index + 2] = (index * 13) % 241;
        pixels.data[index + 3] = 255;
      }
      context.putImageData(pixels, 0, 0);
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
      if (!blob) throw new Error("No picture");
      const data = new DataTransfer();
      data.items.add(new File([blob], "foto-grande.png", { type: "image/png" }));
      input.files = data.files;
      input.dispatchEvent(new Event("change", { bubbles: true }));
      return blob.size;
    });
    expect(pickedBytes).toBeGreaterThan(5 * 1024 * 1024);
    expect(pickedBytes).toBeLessThanOrEqual(25 * 1024 * 1024);

    await expect(
      senderChat.getByRole("img", { name: /Imagem anexada: foto-grande\./ }),
    ).toBeVisible({
      timeout: 15_000,
    });
    await sender.page.getByPlaceholder("Escreva para a sala").press("Enter");
    const received = receiverChat.getByRole("img", { name: /Imagem: foto-grande\./ });
    await expect(received).toBeVisible({ timeout: 30_000 });
    // Measured on what arrived: the file that went out, after the reduction.
    const arrived = await receiver.page.evaluate(() => {
      const made = (window as unknown as { madeBlobs: { size: number; type: string }[] }).madeBlobs;
      return made.at(-1);
    });
    expect(arrived).toBeDefined();
    expect(arrived?.size).toBeLessThanOrEqual(5 * 1024 * 1024);
    expect(["image/webp", "image/jpeg"]).toContain(arrived?.type);
    expect(await received.evaluate((image) => (image as HTMLImageElement).naturalWidth)).toBe(2560);
  } finally {
    await sender.context.close();
    await receiver.context.close();
  }
});

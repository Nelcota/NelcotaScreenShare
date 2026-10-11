import { expect, test } from "@playwright/test";
import { joinRoom, newParticipant, newRoomCode } from "./support/session";

test("remote chat shows a notice and the selected sound, while open chat and mute remain silent", async ({
  browser,
}) => {
  const receiver = await newParticipant(browser, "Recebe Avisos");
  const sender = await newParticipant(browser, "Envia Avisos");
  await receiver.page.addInitScript(() => {
    const target = window as Window & { chatSoundNotes?: number };
    target.chatSoundNotes = 0;
    const original = Reflect.get(AudioContext.prototype, "createOscillator");
    AudioContext.prototype.createOscillator = function () {
      target.chatSoundNotes = (target.chatSoundNotes ?? 0) + 1;
      return original.call(this);
    };
  });
  const code = newRoomCode();
  await joinRoom(receiver.page, code);
  await joinRoom(sender.page, code);
  await receiver.page.getByRole("button", { name: /^Chat/ }).click();
  await receiver.page.getByRole("combobox", { name: "Som do aviso" }).selectOption("chime");
  await receiver.page.getByRole("button", { name: "Ouvir som da notificação" }).click();
  const notes = () =>
    receiver.page.evaluate(() => (window as Window & { chatSoundNotes?: number }).chatSoundNotes);
  await expect.poll(notes).toBe(2);
  await receiver.page.getByRole("button", { name: "Fechar chat" }).click();
  await sender.page.getByRole("button", { name: /^Chat/ }).click();
  async function send(message: string) {
    await sender.page.getByPlaceholder("Escreva para a sala").fill(message);
    await sender.page.getByRole("button", { name: "Enviar mensagem" }).click();
  }
  await send("Aviso com duas notas");
  await expect(
    receiver.page.getByText("Envia Avisos: Aviso com duas notas", { exact: true }),
  ).toBeVisible();
  await expect.poll(notes).toBe(4);
  await receiver.page.getByRole("button", { name: "Abrir", exact: true }).click();
  await send("Com o chat aberto");
  await expect(
    receiver.page
      .getByRole("complementary", { name: "Chat da sala" })
      .getByText("Com o chat aberto", { exact: true }),
  ).toBeVisible();
  expect(await notes()).toBe(4);
  await receiver.page.getByRole("combobox", { name: "Som do aviso" }).selectOption("off");
  await receiver.page.getByRole("button", { name: "Fechar chat" }).click();
  await send("Aviso sem som");
  const silentNotice = receiver.page.getByText("Envia Avisos: Aviso sem som", { exact: true });
  await expect(silentNotice).toBeVisible();
  // In a call, chat notices sit at the bottom so the room's top bar stays readable.
  await expect(
    receiver.page.locator('[data-sonner-toast][data-y-position="bottom"]', { has: silentNotice }),
  ).toBeVisible();
  expect(await notes()).toBe(4);
  // A notice from someone who left goes away with them.
  await sender.page.getByRole("button", { name: "Sair da sala", exact: true }).click();
  await sender.page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Sair", exact: true })
    .click();
  await expect(silentNotice).toBeHidden();
  await joinRoom(receiver.page, code);
  await receiver.page.getByRole("button", { name: /^Chat/ }).click();
  await expect(receiver.page.getByRole("combobox", { name: "Som do aviso" })).toHaveValue("off");
  await receiver.page.setViewportSize({ width: 320, height: 740 });
  await expect(receiver.page.getByRole("combobox", { name: "Som do aviso" })).toBeVisible();
  await receiver.context.close();
  await sender.context.close();
});

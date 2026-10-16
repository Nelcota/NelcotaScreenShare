import { expect, test } from "@playwright/test";
import { chooseOption, joinRoom, newParticipant, newRoomCode } from "./support/session";

test("remote chat shows a notice and the selected sound, while open chat and mute remain silent", async ({
  browser,
}) => {
  const receiver = await newParticipant(browser, "Recebe Avisos");
  const sender = await newParticipant(browser, "Envia Avisos");
  await receiver.page.addInitScript(() => {
    if (localStorage.getItem("nelcota-chat-notification-sound") === null) {
      localStorage.setItem("nelcota-chat-notification-sound", "off");
    }
    // Only chat sounds are counted: the call's own (someone joining) stay off.
    const preferences = "nelcota-notification-preferences";
    const saved: unknown = JSON.parse(localStorage.getItem(preferences) ?? "{}");
    localStorage.setItem(
      preferences,
      JSON.stringify({ ...(typeof saved === "object" ? saved : {}), callSounds: false }),
    );
    const target = window as Window & { chatSoundNotes?: number };
    target.chatSoundNotes = 0;
    const original = Reflect.get(AudioContext.prototype, "createOscillator");
    AudioContext.prototype.createOscillator = function () {
      target.chatSoundNotes = (target.chatSoundNotes ?? 0) + 1;
      return original.call(this);
    };
  });
  const code = await newRoomCode();
  await joinRoom(receiver.page, code);
  await joinRoom(sender.page, code);
  await receiver.page.getByRole("button", { name: /^Chat/ }).click();
  await expect(receiver.page.getByRole("combobox", { name: "Som do aviso" })).toHaveText("Sem som");
  await chooseOption(receiver.page, "Som do aviso", "Duas notas");
  const notes = () =>
    receiver.page.evaluate(() => (window as Window & { chatSoundNotes?: number }).chatSoundNotes);
  expect(await notes()).toBe(0);
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
  await expect.poll(notes).toBe(2);
  // The notice is a pill clicks pass through: the chat opens from the dock.
  await receiver.page.getByRole("button", { name: /^Chat/ }).click();
  await receiver.page.getByRole("button", { name: "Ouvir som da notificação" }).click();
  await expect.poll(notes).toBe(4);
  await send("Com o chat aberto");
  await expect(
    receiver.page
      .getByRole("complementary", { name: "Chat da sala" })
      .getByText("Com o chat aberto", { exact: true }),
  ).toBeVisible();
  expect(await notes()).toBe(4);
  await chooseOption(receiver.page, "Som do aviso", "Sem som");
  await receiver.page.getByRole("button", { name: "Fechar chat" }).click();
  await send("Aviso sem som");
  const silentNotice = receiver.page.getByText("Envia Avisos: Aviso sem som", { exact: true });
  await expect(silentNotice).toBeVisible();
  // In a call, chat notices are pills at the top right, under the top bar, behind menus.
  await expect(
    receiver.page.locator('[data-sonner-toast][data-y-position="top"][data-x-position="right"]', {
      has: silentNotice,
    }),
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
  await expect(receiver.page.getByRole("combobox", { name: "Som do aviso" })).toHaveText("Sem som");
  await receiver.page.setViewportSize({ width: 320, height: 740 });
  await expect(receiver.page.getByRole("combobox", { name: "Som do aviso" })).toBeVisible();
  await receiver.context.close();
  await sender.context.close();
});

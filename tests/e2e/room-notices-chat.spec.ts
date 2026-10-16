import { expect, test, type Locator } from "@playwright/test";
import { joinRoom, newParticipant, newRoomCode } from "./support/session";

async function overlaps(one: Locator, other: Locator) {
  const [a, b] = await Promise.all([one.boundingBox(), other.boundingBox()]);
  if (!a || !b) throw new Error("Both elements must be on screen.");
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

test("room notices sit beside the open chat on wide screens and wait behind it on narrow ones", async ({
  browser,
}) => {
  const receiver = await newParticipant(browser, "Leitora Chat");
  const sender = await newParticipant(browser, "Fala Sala");
  await receiver.page.setViewportSize({ width: 1280, height: 800 });
  const code = await newRoomCode();
  await joinRoom(receiver.page, code, { micOn: false });
  await receiver.page.getByRole("button", { name: /^Chat/ }).click();
  const chat = receiver.page.getByRole("complementary", { name: "Chat da sala" });
  await expect(chat).toBeVisible();

  await joinRoom(sender.page, code, { micOn: false });
  const joined = receiver.page
    .locator("[data-sonner-toast]")
    .filter({ hasText: "Fala Sala entrou na sala" });
  await expect(joined).toBeVisible();
  expect(await overlaps(joined, chat)).toBe(false);

  await receiver.page.setViewportSize({ width: 375, height: 812 });
  const latecomer = await newParticipant(browser, "Chega Depois");
  await joinRoom(latecomer.page, code, { micOn: false });
  const hiddenNotice = receiver.page
    .locator("[data-sonner-toast]")
    .filter({ hasText: "Chega Depois" });
  await expect(hiddenNotice).toHaveCount(1);
  await expect(hiddenNotice).toBeHidden();

  await receiver.page.getByRole("button", { name: "Fechar chat" }).click();
  await sender.page.getByRole("button", { name: /^Chat/ }).click();
  await sender.page.getByPlaceholder("Escreva para a sala").fill("Com o chat fechado");
  await sender.page.getByRole("button", { name: "Enviar mensagem" }).click();
  await expect(
    receiver.page.getByText("Fala Sala: Com o chat fechado", { exact: true }),
  ).toBeVisible();

  await receiver.context.close();
  await sender.context.close();
  await latecomer.context.close();
});

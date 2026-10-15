import { expect, test } from "@playwright/test";
import { fakeScreenCapture } from "./support/screen-capture";
import { E2E_ACCESS_PASSWORD } from "./support/env";
import {
  joinRoom,
  newParticipant,
  newRoomCode,
  newVisitor,
  setJoinMicrophone,
} from "./support/session";

test("the minimized call mutes, stops hearing and goes back without showing the code", async ({
  browser,
}) => {
  const { page, context } = await newParticipant(browser, "Card Minimizado");
  const code = await newRoomCode();
  await joinRoom(page, code);
  await page.getByRole("button", { name: "Mais opções", exact: true }).click();
  await page.getByRole("link", { name: "Configurações", exact: true }).click();

  const card = page.getByRole("complementary", { name: "Chamada em andamento" });
  await expect(card).toBeVisible();
  await expect(card).not.toContainText(code);
  await expect(card.getByRole("list", { name: "Na chamada" }).getByRole("listitem")).toHaveCount(1);
  await expect(card.getByRole("listitem")).toContainText("CM");
  await expect(card.getByRole("listitem")).toContainText("Você");

  await card.getByRole("button", { name: "Desligar microfone" }).click();
  await expect(card.getByRole("button", { name: "Ligar microfone" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await card.getByRole("button", { name: "Parar de ouvir a sala" }).click();
  await expect(card.getByRole("button", { name: "Voltar a ouvir a sala" })).toBeVisible();
  await card.getByRole("button", { name: "Voltar a ouvir a sala" }).click();
  await expect(card.getByRole("button", { name: "Parar de ouvir a sala" })).toBeVisible();

  await card.getByRole("link", { name: "Voltar à chamada" }).click();
  await expect(page.getByRole("button", { name: /Ligar microfone/ })).toBeVisible();
  await context.close();
});

test("the minimized call drags, stops sharing and leaves after confirming", async ({ browser }) => {
  const { page, context } = await newParticipant(browser, "Card Arrasta");
  await fakeScreenCapture(page);
  await joinRoom(page, await newRoomCode(), { micOn: false });
  await page.getByRole("button", { name: "Compartilhar tela", exact: true }).click();
  await page.getByRole("button", { name: /^Tela inteira/ }).click();
  await expect(page.getByLabel("Prévia da sua tela")).toBeVisible();
  await page.getByRole("button", { name: "Mais opções", exact: true }).click();
  await page.getByRole("link", { name: "Configurações", exact: true }).click();

  const card = page.getByRole("complementary", { name: "Chamada em andamento" });
  const before = await card.boundingBox();
  if (!before) throw new Error("Card not on screen");
  // The page transition covers everything for a moment: drag once the card is on top.
  await expect
    .poll(() =>
      page.evaluate(
        ([x, y]) => document.elementFromPoint(x ?? 0, y ?? 0)?.tagName,
        [before.x + 6, before.y + before.height / 2],
      ),
    )
    .toBe("ASIDE");
  await page.mouse.move(before.x + 6, before.y + before.height / 2);
  await page.mouse.down();
  await page.mouse.move(before.x - 300, before.y - 200, { steps: 8 });
  await page.mouse.up();
  const after = await card.boundingBox();
  expect(after?.x).toBeLessThan(before.x - 250);
  expect(after?.y).toBeLessThan(before.y - 150);
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem("nelcota:cartao-chamada")))
    .toContain("right");

  if (!after) throw new Error("Card not on screen");
  await page.mouse.move(after.x + 6, after.y + after.height / 2);
  await page.mouse.down();
  await page.mouse.move(after.x + 6, after.y + 2000, { steps: 4 });
  await page.mouse.up();
  const viewport = page.viewportSize();
  const kept = await card.boundingBox();
  expect(kept && viewport && kept.y + kept.height <= viewport.height).toBe(true);

  await card.getByRole("button", { name: "Parar de compartilhar" }).click();
  await expect(card.getByRole("button", { name: "Parar de compartilhar" })).toHaveCount(0);

  await card.getByRole("button", { name: "Sair da sala" }).click();
  await page
    .getByRole("alertdialog", { name: "Sair da sala?" })
    .getByRole("button", { name: "Sair", exact: true })
    .click();
  await expect(card).toHaveCount(0);
  await expect(page.getByText("Você saiu da chamada.")).toBeVisible();
  await context.close();
});

test("clicking the faces on the minimized call goes back to it", async ({ browser }) => {
  const { page, context } = await newParticipant(browser, "Card Rostos");
  try {
    await joinRoom(page, await newRoomCode(), { micOn: false });
    await page.getByRole("button", { name: "Mais opções", exact: true }).click();
    await page.getByRole("link", { name: "Configurações", exact: true }).click();
    const card = page.getByRole("complementary", { name: "Chamada em andamento" });
    await expect(card).toBeVisible();
    await card.getByRole("list", { name: "Na chamada" }).click();
    await expect(card).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Sair da sala", exact: true })).toBeVisible();
  } finally {
    await context.close();
  }
});

test("the room's logo leads to the start and the call goes on minimized", async ({ browser }) => {
  const { page, context } = await newParticipant(browser, "Logo Sala");
  try {
    await joinRoom(page, await newRoomCode(), { micOn: false });
    await page
      .getByRole("navigation", { name: "Sala", exact: true })
      .getByRole("link", { name: "Nelcota, início", exact: true })
      .click();
    await expect(page).toHaveURL(/\/inicio$/);
    await expect(page.getByRole("complementary", { name: "Chamada em andamento" })).toBeVisible();
  } finally {
    await context.close();
  }
});

test("a guest's room logo leads to the home page, still in the call", async ({ browser }) => {
  const host = await newParticipant(browser, "Anfitria Logo");
  const { page, context } = await newVisitor(browser);
  try {
    const code = await newRoomCode();
    // A guest joins once someone with an account is in the room.
    await joinRoom(host.page, code, { micOn: false });
    await page.goto(`/sala/${code}`);
    await page.getByLabel("Seu nome na sala", { exact: true }).fill("Convidada Logo");
    await setJoinMicrophone(page, false);
    await page.getByLabel("Senha da sala").fill(E2E_ACCESS_PASSWORD);
    await page.getByRole("button", { name: "Entrar só ouvindo", exact: true }).click();
    await page
      .getByRole("navigation", { name: "Sala", exact: true })
      .getByRole("link", { name: "Nelcota, início", exact: true })
      .click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("complementary", { name: "Chamada em andamento" })).toBeVisible();
  } finally {
    await Promise.all([context.close(), host.context.close()]);
  }
});

test("before anyone speaks, the minimized call shows how many people are in it", async ({
  browser,
}) => {
  const first = await newParticipant(browser, "Quieta Um");
  const second = await newParticipant(browser, "Quieta Dois");
  try {
    const code = await newRoomCode();
    await joinRoom(first.page, code, { micOn: false });
    await joinRoom(second.page, code, { micOn: false });
    await first.page.getByRole("button", { name: "Mais opções", exact: true }).click();
    await first.page.getByRole("link", { name: "Configurações", exact: true }).click();
    const card = first.page.getByRole("complementary", { name: "Chamada em andamento" });
    await expect(card.getByText("2 pessoas", { exact: true })).toBeVisible();
    await expect(card.getByRole("list", { name: "Na chamada" })).toHaveCount(0);
  } finally {
    await Promise.all([first.context.close(), second.context.close()]);
  }
});

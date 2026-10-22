import { expect, test, type Locator, type Page } from "@playwright/test";
import { joinRoom, newParticipant, newRoomCode } from "./support/session";

type Box = { x: number; y: number; width: number; height: number };

function overlaps(a: Box, b: Box): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

async function box(locator: Locator): Promise<Box> {
  const found = await locator.boundingBox();
  if (!found) throw new Error("Element has no box");
  return found;
}

/** Drags the card by its faces, so the press is a move and never a tap. */
async function dragCardTo(page: Page, card: Locator, target: { x: number; y: number }) {
  const faces = await box(card.locator("[data-back-to-call]"));
  await page.mouse.move(faces.x + 12, faces.y + faces.height / 2);
  await page.mouse.down();
  await page.mouse.move(target.x, target.y, { steps: 12 });
  await page.mouse.up();
}

test("the minimized call card never rests on the start's room field", async ({ browser }) => {
  const { page, context } = await newParticipant(browser, "Cartao Campo");
  try {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await joinRoom(page, await newRoomCode(), { micOn: false });
    await page.getByRole("button", { name: "Mais opções", exact: true }).click();
    await page
      .getByRole("dialog")
      .getByRole("link", { name: "Configurações", exact: true })
      .click();
    const card = page.getByRole("complementary", { name: "Chamada em andamento" });
    await expect(card).toBeVisible();

    // Left in the middle of another page, the card stays there.
    await dragCardTo(page, card, { x: 640, y: 420 });
    const middle = await box(card);
    expect(middle.y).toBeLessThan(500);

    // On the start, the field sits under that place: the card moves to a corner.
    await page.locator('a[href="/inicio"]').first().click();
    await expect(page).toHaveURL(/\/inicio/);
    const field = page.locator("form[data-call-card-clear]").first();
    await expect(field).toBeVisible();
    await expect.poll(async () => overlaps(await box(card), await box(field))).toBe(false);

    // Dropped right on the field, it slides to the nearest corner.
    const fieldBox = await box(field);
    await dragCardTo(page, card, {
      x: fieldBox.x + fieldBox.width / 2,
      y: fieldBox.y + fieldBox.height - 20,
    });
    await expect.poll(async () => overlaps(await box(card), await box(field))).toBe(false);
  } finally {
    await context.close();
  }
});

test("the minimized call card dropped by an edge sticks to it at the same height", async ({
  browser,
}) => {
  const { page, context } = await newParticipant(browser, "Cartao Borda");
  try {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await joinRoom(page, await newRoomCode(), { micOn: false });
    await page.getByRole("button", { name: "Mais opções", exact: true }).click();
    await page
      .getByRole("dialog")
      .getByRole("link", { name: "Configurações", exact: true })
      .click();
    const card = page.getByRole("complementary", { name: "Chamada em andamento" });
    await expect(card).toBeVisible();

    const start = await box(card);
    // Grabbed by its left side, dropped near the right edge, halfway down.
    await dragCardTo(page, card, { x: 1280 - start.width + 4, y: 400 });
    await expect
      .poll(async () => {
        const settled = await box(card);
        return Math.round(1280 - (settled.x + settled.width));
      })
      .toBe(16);
    const settled = await box(card);
    expect(Math.abs(settled.y + settled.height / 2 - 400)).toBeLessThan(40);
  } finally {
    await context.close();
  }
});

test("the minimized call card never rests on the sidebar's account and settings", async ({
  browser,
}) => {
  const { page, context } = await newParticipant(browser, "Cartao Rodape");
  try {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await joinRoom(page, await newRoomCode(), { micOn: false });
    await page.getByRole("button", { name: "Mais opções", exact: true }).click();
    await page
      .getByRole("dialog")
      .getByRole("link", { name: "Configurações", exact: true })
      .click();
    const card = page.getByRole("complementary", { name: "Chamada em andamento" });
    await expect(card).toBeVisible();
    const footer = page.locator("aside[aria-label='Amigos'] [data-call-card-clear]");
    await expect(footer).toBeVisible();

    // Dropped against the bottom, right over the account and the settings gear.
    const footerBox = await box(footer);
    await dragCardTo(page, card, { x: footerBox.x + 40, y: 795 });
    await expect.poll(async () => overlaps(await box(card), await box(footer))).toBe(false);
  } finally {
    await context.close();
  }
});

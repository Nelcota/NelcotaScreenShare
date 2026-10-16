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
    await page.getByRole("link", { name: "Configurações", exact: true }).click();
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

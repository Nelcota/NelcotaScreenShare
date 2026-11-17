import { expect, test, type Page } from "@playwright/test";
import { joinRoom, newParticipant, newRoomCode } from "./support/session";

/** Where each dock button starts on screen, rounded to whole pixels. */
async function dockButtonPositions(page: Page): Promise<number[]> {
  const buttons = page
    .getByRole("navigation", { name: "Controles da chamada" })
    .locator("button[data-anim=dock-item]")
    .filter({ visible: true });
  const boxes = await Promise.all((await buttons.all()).map((button) => button.boundingBox()));
  return boxes.map((box) => Math.round(box?.x ?? -1));
}

test("the dock's buttons stay put when the chat or the friends column open", async ({
  browser,
}) => {
  const { page, context } = await newParticipant(browser, "Dock Parado");
  try {
    await page.setViewportSize({ width: 1440, height: 900 });
    await joinRoom(page, await newRoomCode(), { micOn: false });
    const chatButton = page.getByRole("button", { name: /^Chat/ });
    const chat = page.getByRole("complementary", { name: "Chat da sala" });
    const column = page.getByRole("complementary", { name: "Amigos" });
    const dock = page.getByRole("navigation", { name: "Controles da chamada" });
    await expect(dock).toBeVisible();
    const before = await dockButtonPositions(page);

    await chatButton.click();
    await expect(chat).toBeVisible();
    await expect.poll(() => dockButtonPositions(page)).toEqual(before);

    await column.getByRole("button", { name: "Abrir amigos" }).click();
    await expect(column.getByRole("button", { name: "Recolher amigos" })).toBeVisible();
    await expect.poll(() => dockButtonPositions(page)).toEqual(before);

    await chatButton.click();
    await expect(chat).toBeHidden();
    await column.getByRole("button", { name: "Recolher amigos" }).click();
    await expect(column.getByRole("button", { name: "Abrir amigos" })).toBeVisible();
    await expect.poll(() => dockButtonPositions(page)).toEqual(before);

    // The dock sits at the window's center, not at the center of the space left over.
    const box = await dock.boundingBox();
    expect(Math.abs((box?.x ?? 0) + (box?.width ?? 0) / 2 - 720)).toBeLessThanOrEqual(1);

    await page.setViewportSize({ width: 375, height: 812 });
    const onPhone = await dockButtonPositions(page);
    await chatButton.click();
    await expect(chat).toBeVisible();
    await expect.poll(() => dockButtonPositions(page)).toEqual(onPhone);
  } finally {
    await context.close();
  }
});

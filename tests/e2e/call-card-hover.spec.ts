import { expect, test } from "@playwright/test";
import { joinRoom, newParticipant, newRoomCode } from "./support/session";

test("pointing at a call card lights nothing and adds no button; the photo opens the profile", async ({
  browser,
}) => {
  const viewer = await newParticipant(browser, "Olha Cartao");
  const other = await newParticipant(browser, "Bia Cartao");
  try {
    const code = await newRoomCode();
    await joinRoom(viewer.page, code, { micOn: false });
    await joinRoom(other.page, code, { micOn: false });
    const page = viewer.page;
    const tile = page.locator("[data-flip-id^='tile-']").filter({ hasText: "Bia Cartao" });
    await expect(tile).toBeVisible();
    const surface = tile.locator(":scope > div").nth(1);
    const borderBefore = await surface.evaluate((element) => getComputedStyle(element).borderColor);

    await tile.hover();
    await page.waitForTimeout(400);
    await expect(page.getByText("Ver perfil", { exact: true })).toHaveCount(0);
    expect(await surface.evaluate((element) => getComputedStyle(element).borderColor)).toBe(
      borderBefore,
    );

    await page.getByRole("button", { name: "Ver Bia Cartao" }).first().click();
    await expect(page.getByRole("button", { name: "Denunciar" })).toBeVisible();
  } finally {
    await viewer.context.close();
    await other.context.close();
  }
});

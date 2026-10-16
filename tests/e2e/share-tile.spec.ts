import { expect, test } from "@playwright/test";
import { fakeScreenCapture } from "./support/screen-capture";
import { joinRoom, newParticipant, newRoomCode } from "./support/session";

test("the sharer's tile becomes the screen card, with a blurred preview, until Assistir", async ({
  browser,
}) => {
  const sharer = await newParticipant(browser, "Tela No Tile");
  const viewer = await newParticipant(browser, "Olha Tile");
  try {
    await fakeScreenCapture(sharer.page);
    const code = await newRoomCode();
    await joinRoom(sharer.page, code, { micOn: false });
    await joinRoom(viewer.page, code, { micOn: false });
    await sharer.page.getByRole("button", { name: "Compartilhar tela", exact: true }).click();
    await sharer.page.getByRole("button", { name: /^Tela inteira/ }).click();

    const watch = viewer.page.getByRole("button", { name: "Assistir à tela de Tela No Tile" });
    await expect(watch).toBeVisible();
    await expect(viewer.page.getByText("Tela No Tile está compartilhando a tela")).toBeAttached();
    // The first frame arrives in a few seconds, only in memory, as a small WebP or JPEG.
    const preview = viewer.page.locator('[data-flip-id] img[src^="data:image/"]');
    await expect(preview).toHaveCount(1, { timeout: 15_000 });
    expect((await preview.getAttribute("src"))?.length ?? 0).toBeLessThan(24_000);

    await watch.click();
    await expect(
      viewer.page.getByRole("region", { name: "Tela compartilhada por Tela No Tile" }),
    ).toBeVisible();
    await expect(preview).toHaveCount(0);

    await sharer.page.getByRole("button", { name: /^Parar de compartilhar/ }).click();
    await expect(watch).toHaveCount(0);
    await expect(preview).toHaveCount(0);
  } finally {
    await sharer.context.close();
    await viewer.context.close();
  }
});

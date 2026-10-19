import { expect, test } from "@playwright/test";
import { joinRoom, newParticipant, newRoomCode } from "./support/session";
import { fakeScreenCapture } from "./support/screen-capture";

test("whoever watches a screen stops from the dock and can watch it again", async ({ browser }) => {
  const sharer = await newParticipant(browser, "Mostra Dock");
  const viewer = await newParticipant(browser, "Assiste Dock");
  try {
    await fakeScreenCapture(sharer.page);
    const code = await newRoomCode();
    await joinRoom(sharer.page, code, { micOn: false });
    await joinRoom(viewer.page, code, { micOn: false });
    await sharer.page.getByRole("button", { name: "Compartilhar tela", exact: true }).click();
    await sharer.page.getByRole("button", { name: /^Tela inteira/ }).click();

    const dock = viewer.page.getByRole("navigation", { name: "Controles da chamada" });
    const stop = dock.getByRole("button", { name: "Parar de assistir" });
    const watch = viewer.page.getByRole("button", { name: "Assistir à tela de Mostra Dock" });
    // The sharer does not watch their own screen: nothing to stop.
    await expect(
      sharer.page
        .getByRole("navigation", { name: "Controles da chamada" })
        .getByRole("button", { name: "Parar de assistir" }),
    ).toHaveCount(0);
    await expect(stop).toHaveCount(0);

    await watch.click();
    await expect(viewer.page.getByLabel("Tela de Mostra Dock")).toBeVisible();
    await stop.click();
    await expect(watch).toBeVisible();
    await expect(stop).toHaveCount(0);

    await watch.click();
    await expect(viewer.page.getByLabel("Tela de Mostra Dock")).toBeVisible();
    await expect(stop).toBeVisible();
  } finally {
    await sharer.context.close();
    await viewer.context.close();
  }
});

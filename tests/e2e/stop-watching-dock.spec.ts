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
    // Only the dock stops it: the screen's own controls have no second button.
    await expect(
      viewer.page
        .getByRole("region", { name: "Tela compartilhada por Mostra Dock" })
        .getByRole("button", { name: "Parar de assistir" }),
    ).toHaveCount(0);
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

test("on a phone, the stop-watching pill above the dock stops the screen", async ({ browser }) => {
  const sharer = await newParticipant(browser, "Mostra Celular");
  const viewer = await newParticipant(browser, "Assiste Celular");
  try {
    await fakeScreenCapture(sharer.page);
    await viewer.page.setViewportSize({ width: 375, height: 812 });
    const code = await newRoomCode();
    await joinRoom(sharer.page, code, { micOn: false });
    await joinRoom(viewer.page, code, { micOn: false });
    await sharer.page.getByRole("button", { name: "Compartilhar tela", exact: true }).click();
    await sharer.page.getByRole("button", { name: /^Tela inteira/ }).click();

    const watch = viewer.page.getByRole("button", { name: "Assistir à tela de Mostra Celular" });
    await watch.click();
    await expect(viewer.page.getByLabel("Tela de Mostra Celular")).toBeVisible();
    const dock = viewer.page.getByRole("navigation", { name: "Controles da chamada" });
    await expect(dock.getByRole("button", { name: "Parar de assistir" })).toBeHidden();
    const pill = viewer.page
      .getByRole("button", { name: "Parar de assistir", exact: true })
      .filter({
        visible: true,
      });
    await pill.last().click();
    await expect(watch).toBeVisible();
  } finally {
    await sharer.context.close();
    await viewer.context.close();
  }
});

test("over a fullscreen screen, moving the mouse brings the dock back to stop watching", async ({
  browser,
}) => {
  const sharer = await newParticipant(browser, "Mostra Cheia");
  const viewer = await newParticipant(browser, "Assiste Cheia");
  try {
    await fakeScreenCapture(sharer.page);
    const code = await newRoomCode();
    await joinRoom(sharer.page, code, { micOn: false });
    await joinRoom(viewer.page, code, { micOn: false });
    await sharer.page.getByRole("button", { name: "Compartilhar tela", exact: true }).click();
    await sharer.page.getByRole("button", { name: /^Tela inteira/ }).click();
    const watch = viewer.page.getByRole("button", { name: "Assistir à tela de Mostra Cheia" });
    await watch.click();

    const stage = viewer.page.getByRole("region", { name: "Tela compartilhada por Mostra Cheia" });
    await stage.getByRole("button", { name: "Tela cheia", exact: true }).click();
    await expect(stage).toHaveAttribute("data-fullscreen", "true");
    const dock = viewer.page.getByRole("navigation", { name: "Controles da chamada" });
    // Hidden, the dock leaves the accessibility tree: find it there too to read its state.
    const dockArea = viewer.page
      .getByRole("navigation", { name: "Controles da chamada", includeHidden: true })
      .locator("..");
    const stop = dock.getByRole("button", { name: "Parar de assistir" });
    // With the mouse still, the screen has the whole page and the hidden dock takes no clicks.
    await expect(dockArea).toHaveCSS("opacity", "0", { timeout: 6_000 });
    await expect(
      dockArea.getByRole("button", { name: "Parar de assistir", includeHidden: true }),
    ).toBeHidden();

    await viewer.page.mouse.move(400, 300);
    await viewer.page.mouse.move(420, 320);
    await expect(dockArea).toHaveCSS("opacity", "1");

    // Keyboard focus on the dock keeps it up, even when the mouse moves elsewhere and stops.
    await stop.focus();
    await viewer.page.keyboard.press("Shift+Tab");
    await viewer.page.keyboard.press("Tab");
    await expect(stop).toBeFocused();
    await viewer.page.mouse.move(400, 300);
    await viewer.page.waitForTimeout(3_500);
    await expect(dockArea).toHaveCSS("opacity", "1");

    await stop.click();
    await expect(watch).toBeVisible();
  } finally {
    await sharer.context.close();
    await viewer.context.close();
  }
});

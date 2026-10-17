import { expect, test } from "@playwright/test";
import { fakeScreenCapture } from "./support/screen-capture";
import { joinRoom, newParticipant, newRoomCode } from "./support/session";

for (const colorScheme of ["dark", "light"] as const) {
  test(`the sharer turns the screen's sound off and on for viewers (${colorScheme})`, async ({
    browser,
  }) => {
    const sharer = await newParticipant(browser, "Som Da Tela");
    const viewer = await newParticipant(browser, "Ouve Tela");
    try {
      await sharer.page.emulateMedia({ reducedMotion: "reduce", colorScheme });
      await viewer.page.emulateMedia({ reducedMotion: "reduce", colorScheme });
      await fakeScreenCapture(sharer.page, { withSound: true, safeAudio: true });
      const code = await newRoomCode();
      await joinRoom(sharer.page, code, { micOn: false });
      await joinRoom(viewer.page, code, { micOn: false });
      await sharer.page.getByRole("button", { name: "Compartilhar tela", exact: true }).click();
      await sharer.page.getByRole("button", { name: /^Tela inteira/ }).click();

      const turnOff = sharer.page.getByRole("button", { name: "Desligar o som da tela" });
      await expect(turnOff).toBeVisible();
      await viewer.page.getByRole("button", { name: "Assistir à tela de Som Da Tela" }).click();
      const volume = viewer.page.getByRole("button", { name: /^Volume da tela/ });
      await expect(volume).toBeVisible();
      await test.info().attach(`sharer-on-${colorScheme}`, {
        body: await sharer.page.locator('[data-flip-id="stage"]').screenshot(),
        contentType: "image/png",
      });

      await turnOff.click();
      const turnOn = sharer.page.getByRole("button", { name: "Ligar o som da tela" });
      await expect(turnOn).toBeVisible();
      await expect(viewer.page.getByText("Tela sem som")).toBeAttached();
      await expect(volume).toHaveCount(0);
      await test.info().attach(`sharer-off-${colorScheme}`, {
        body: await sharer.page.locator('[data-flip-id="stage"]').screenshot(),
        contentType: "image/png",
      });
      await test.info().attach(`viewer-off-${colorScheme}`, {
        body: await viewer.page.locator('[data-flip-id="stage"]').screenshot(),
        contentType: "image/png",
      });

      await turnOn.click();
      await expect(turnOff).toBeVisible();
      await expect(volume).toBeVisible();
    } finally {
      await sharer.context.close();
      await viewer.context.close();
    }
  });
}

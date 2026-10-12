import { expect, test } from "@playwright/test";
import { fakeScreenCapture } from "./support/screen-capture";
import { joinRoom, newParticipant, newRoomCode } from "./support/session";

test("both sharing menus use the saved profile and it persists for the next call", async ({
  browser,
}) => {
  const person = await newParticipant(browser, "Perfil Tela");
  try {
    await fakeScreenCapture(person.page);
    await joinRoom(person.page, newRoomCode());
    await person.page.getByRole("button", { name: "Compartilhar minha tela", exact: true }).click();
    const menu = person.page.getByRole("dialog", { name: "Opções de compartilhamento" });
    const profile = menu.getByLabel("Qualidade do compartilhamento");
    await expect(profile).toHaveValue("automatic");
    await profile.selectOption("text");
    await person.page.keyboard.press("Escape");
    await expect(profile).toBeHidden();
    await person.page.getByRole("button", { name: "Compartilhar tela", exact: true }).click();
    await expect(profile).toHaveValue("text");
    await profile.selectOption("data-saver");
    await person.page.getByRole("button", { name: /^Tela inteira/ }).click();
    await expect(person.page.getByLabel("Prévia da sua tela")).toBeVisible();
    await person.page.getByRole("button", { name: /^Parar de compartilhar/ }).click();
    await expect(
      person.page.getByRole("button", { name: "Compartilhar tela", exact: true }),
    ).toBeVisible();
    await person.page.getByRole("button", { name: "Compartilhar tela", exact: true }).click();
    await expect(menu).toBeVisible();
    await expect(profile).toHaveValue("data-saver");
    await person.page.screenshot({
      path: test.info().outputPath("sharing-profiles-desktop.png"),
      animations: "disabled",
    });
    await person.page.setViewportSize({ width: 640, height: 320 });
    await expect
      .poll(() =>
        menu.evaluate((panel) => {
          const bounds = panel.getBoundingClientRect();
          return bounds.top >= 15 && bounds.bottom <= window.innerHeight - 15;
        }),
      )
      .toBe(true);
    await profile.scrollIntoViewIfNeeded();
    await person.page.screenshot({
      path: test.info().outputPath("sharing-profiles-mobile.png"),
      animations: "disabled",
    });
    await person.page.keyboard.press("Escape");
    await expect(profile).toBeHidden();
    await person.page.reload();
    await joinRoom(person.page, newRoomCode());
    await person.page.getByRole("button", { name: "Compartilhar tela", exact: true }).click();
    await expect(profile).toHaveValue("data-saver");
  } finally {
    await person.context.close();
  }
});

import { expect, test } from "@playwright/test";
import { newParticipant, joinRoom, newRoomCode, expectNoHorizontalScroll } from "./support/session";
import { keyboardMark, annotationBounds } from "./support/annotations";
import { fakeScreenCapture } from "./support/screen-capture";

test.skip(process.env.E2E_HOST_CONTROLS !== "true", "Requires server-authorized annotation epochs");

test("annotations reach real clients, preserve authorship, clear by authority and expire", async ({
  browser,
}) => {
  test.setTimeout(120_000);
  const presenter = await newParticipant(browser, "Apresentador Marcas");
  const viewer = await newParticipant(browser, "Autor Marcas");
  try {
    const code = newRoomCode();
    await fakeScreenCapture(presenter.page);
    await joinRoom(presenter.page, code);
    await joinRoom(viewer.page, code);
    await presenter.page.getByRole("button", { name: "Compartilhar tela", exact: true }).click();
    await presenter.page.getByRole("button", { name: /^Tela inteira/ }).click();
    await expect(viewer.page.getByRole("button", { name: "Anotar na tela" })).toBeVisible();
    await expect(presenter.page.getByRole("button", { name: "Anotar na tela" })).toBeVisible();
    await keyboardMark(viewer.page, "Seta");
    await expect(viewer.page.locator("[data-annotation]")).toHaveCount(1);
    await expect(presenter.page.locator("[data-annotation]")).toHaveCount(1);
    await expect(
      presenter.page
        .getByRole("button", { name: /Anotações temporárias/ })
        .getByText("Autor Marcas", { exact: true }),
    ).toBeVisible();
    await viewer.page.getByRole("button", { name: "Anotar na tela" }).click();
    await expect(
      viewer.page.getByRole("button", { name: "Limpar anotações de todos" }),
    ).toBeHidden();
    await viewer.page.getByRole("button", { name: "Desfazer minha última marca" }).click();
    await expect(presenter.page.locator("[data-annotation]")).toHaveCount(0);
    await viewer.page.keyboard.press("Escape");
    await keyboardMark(viewer.page, "Círculo");
    await expect(presenter.page.locator("[data-annotation] ellipse")).toHaveCount(1);
    await presenter.page.getByRole("button", { name: "Anotar na tela" }).click();
    await presenter.page.getByRole("button", { name: "Limpar anotações de todos" }).click();
    await expect(viewer.page.locator("[data-annotation]")).toHaveCount(0);
    await presenter.page.keyboard.press("Escape");
    await keyboardMark(viewer.page, "Caneta");
    await expect(presenter.page.locator("[data-annotation] polyline")).toHaveCount(1);
    await viewer.page.getByRole("button", { name: "Tela cheia", exact: true }).click();
    await expect(viewer.page.locator("[data-fullscreen]")).toBeVisible();
    await annotationBounds(viewer.page);
    await expect(viewer.page.locator("[data-annotation]")).toHaveCount(1);
    await viewer.page.screenshot({
      path: test.info().outputPath("annotations-fullscreen.png"),
      animations: "disabled",
    });
    await viewer.page.getByRole("button", { name: "Sair da tela cheia", exact: true }).click();
    await viewer.page.setViewportSize({ width: 390, height: 740 });
    await expectNoHorizontalScroll(viewer.page);
    await annotationBounds(viewer.page);
    await viewer.page.screenshot({
      path: test.info().outputPath("annotations-mobile.png"),
      animations: "disabled",
    });
    await expect(presenter.page.locator("[data-annotation]")).toHaveCount(0, { timeout: 15_000 });
    await expect(viewer.page.locator("[data-annotation]")).toHaveCount(0);
    await presenter.page.getByRole("button", { name: /Parar de compartilhar/ }).click();
    await expect(viewer.page.getByRole("button", { name: "Anotar na tela" })).toBeHidden();
  } finally {
    await Promise.all([presenter.context.close(), viewer.context.close()]);
  }
});

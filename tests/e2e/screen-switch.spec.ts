import { expect, test, type Page } from "@playwright/test";
import { fakeScreenCapture } from "./support/screen-capture";
import { joinRoom, newParticipant, newRoomCode } from "./support/session";

async function shareScreen(page: Page) {
  await page.getByRole("button", { name: "Compartilhar tela", exact: true }).click();
  await page.getByRole("button", { name: /^Tela inteira/ }).click();
  await expect(page.getByRole("button", { name: /^Parar de compartilhar/ })).toBeVisible();
}

test("switches shared screens, clears pointing and recovers when the selected share stops", async ({
  browser,
}) => {
  const first = await newParticipant(browser, "Primeira Tela");
  const second = await newParticipant(browser, "Segunda Tela");
  const viewer = await newParticipant(browser, "Assistindo Telas");
  await fakeScreenCapture(first.page);
  await fakeScreenCapture(second.page);
  const code = await newRoomCode();
  await joinRoom(first.page, code);
  await joinRoom(second.page, code);
  await joinRoom(viewer.page, code);
  await shareScreen(first.page);
  await expect(
    viewer.page.getByRole("region", { name: "Tela compartilhada por Primeira Tela" }),
  ).toBeVisible();
  await shareScreen(second.page);
  await expect(
    viewer.page.getByRole("region", { name: "Tela compartilhada por Segunda Tela" }),
  ).toBeVisible();
  const picker = viewer.page.getByRole("group", { name: "Escolher a tela compartilhada" });
  await picker.getByRole("button", { name: "Primeira Tela", exact: true }).click();
  await expect(picker.getByRole("button", { name: "Primeira Tela", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(
    viewer.page.getByRole("region", { name: "Tela compartilhada por Primeira Tela" }),
  ).toBeVisible();
  await viewer.page.getByRole("button", { name: "Apontar na tela", exact: true }).click();
  await expect(viewer.page.getByRole("button", { name: "Parar de apontar" })).toBeVisible();
  await viewer.page.setViewportSize({ width: 320, height: 740 });
  await picker.getByRole("button", { name: "Segunda Tela", exact: true }).click();
  await expect(
    viewer.page.getByRole("region", { name: "Tela compartilhada por Segunda Tela" }),
  ).toBeVisible();
  await expect(
    viewer.page.getByRole("button", { name: "Apontar na tela", exact: true }),
  ).toBeVisible();
  await second.page.getByRole("button", { name: /^Parar de compartilhar/ }).click();
  await expect(
    viewer.page.getByRole("region", { name: "Tela compartilhada por Primeira Tela" }),
  ).toBeVisible();
  await expect(picker).toHaveCount(0);
  await expect(
    viewer.page.getByRole("button", { name: "Desligar microfone", exact: true }),
  ).toBeVisible();
  await first.context.close();
  await second.context.close();
  await viewer.context.close();
});

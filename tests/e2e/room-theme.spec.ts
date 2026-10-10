import { expect, test } from "@playwright/test";
import { joinRoom, newParticipant, newRoomCode } from "./support/session";

test("the call switches themes on desktop and mobile without disconnecting", async ({
  browser,
}) => {
  const { page, context } = await newParticipant(browser, "Tema Teste");
  try {
    await page.emulateMedia({ reducedMotion: "reduce", colorScheme: "dark" });
    await joinRoom(page, newRoomCode(), { micOn: false });
    await page.getByRole("button", { name: "Ativar modo claro", exact: true }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    await page.getByRole("button", { name: "Ativar modo escuro", exact: true }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole("button", { name: "Mais opções", exact: true }).click();
    await page.getByRole("button", { name: "Ativar modo claro", exact: true }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    await expect(page.getByRole("button", { name: "Sair da sala", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Ligar microfone", exact: true })).toBeVisible();
    await page.screenshot({ path: test.info().outputPath("room-theme-mobile.png") });
  } finally {
    await context.close();
  }
});

import { expect, test } from "@playwright/test";
import { joinRoom, newParticipant, newRoomCode } from "./support/session";

test("the call switches themes on desktop and mobile without disconnecting", async ({
  browser,
}) => {
  const { page, context } = await newParticipant(browser, "Tema Teste");
  try {
    await page.emulateMedia({ reducedMotion: "reduce", colorScheme: "dark" });
    await joinRoom(page, await newRoomCode(), { micOn: false });
    await page.getByRole("button", { name: "Ativar modo claro", exact: true }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    await page.getByRole("button", { name: "Ativar modo escuro", exact: true }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await page.getByRole("button", { name: "Mais opções", exact: true }).click();
    const shortcuts = page.getByText("Atalhos na sala", { exact: true });
    await expect(shortcuts).toBeVisible();
    const menuSection = shortcuts;
    expect(
      await menuSection.evaluate((element) => {
        const container = element.parentElement;
        if (!container) throw new Error("Missing shortcuts container");
        const style = getComputedStyle(container);
        return [style.marginTop, style.paddingTop, style.borderTopWidth];
      }),
    ).toEqual(["0px", "0px", "0px"]);
    await page.keyboard.press("Escape");
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole("button", { name: "Mais opções", exact: true }).click();
    await page.getByRole("button", { name: "Ativar modo claro", exact: true }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    await expect(page.getByRole("button", { name: "Sair da sala", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Ligar microfone", exact: true })).toBeVisible();
  } finally {
    await context.close();
  }
});

import { expect, test } from "@playwright/test";
import { joinRoom, newParticipant, newRoomCode } from "./support/session";

test("the microphone test inside the call silences both ways and puts everything back", async ({
  browser,
}) => {
  const { page, context } = await newParticipant(browser, "Teste Na Chamada");
  try {
    await joinRoom(page, await newRoomCode());
    const dock = page.getByRole("navigation", { name: "Controles da chamada", exact: true });
    await expect(
      dock.getByRole("button", { name: "Desligar microfone", exact: true }),
    ).toBeVisible();

    await dock.getByRole("button", { name: "Opções do microfone", exact: true }).click();
    const menu = page.getByRole("dialog", { name: "Microfone", exact: true });
    await expect(menu.getByRole("switch", { name: "Redução de ruído" })).toBeChecked();
    await menu.getByRole("button", { name: "Testar microfone", exact: true }).click();

    await expect(
      menu.getByText("Ninguém te ouve e o som da sala está desligado.", { exact: false }),
    ).toBeVisible();
    await expect(menu.getByText("Use fone para não microfonar.")).toBeVisible();
    // The level bar fills with the voice (the fake microphone sends a tone).
    await expect
      .poll(() =>
        menu.evaluate(
          (panel) => panel.querySelector(".origin-left")?.getBoundingClientRect().width ?? 0,
        ),
      )
      .toBeGreaterThan(0);
    await expect(dock.getByRole("button", { name: "Parar teste do microfone" })).toBeVisible();
    await expect(dock.getByRole("button", { name: "Voltar a ouvir a sala" })).toBeVisible();
    await expect(dock.getByText("Sem som", { exact: true })).toBeVisible();
    await expect(dock.getByText("Testando", { exact: true })).toBeVisible();

    await menu.getByRole("button", { name: "Parar teste", exact: true }).click();
    await expect(
      dock.getByRole("button", { name: "Desligar microfone", exact: true }),
    ).toBeVisible();
    await expect(dock.getByRole("button", { name: "Parar de ouvir a sala" })).toBeVisible();

    // With the microphone off before the test, it stays off after.
    await page.keyboard.press("Escape");
    await dock.getByRole("button", { name: "Desligar microfone", exact: true }).click();
    await dock.getByRole("button", { name: "Opções do microfone", exact: true }).click();
    await menu.getByRole("button", { name: "Testar microfone", exact: true }).click();
    await page.keyboard.press("m");
    await expect(dock.getByRole("button", { name: "Ligar microfone", exact: true })).toBeVisible();
    await expect(dock.getByRole("button", { name: "Parar de ouvir a sala" })).toBeVisible();
  } finally {
    await context.close();
  }
});

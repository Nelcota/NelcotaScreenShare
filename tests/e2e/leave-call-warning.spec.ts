import { expect, test } from "@playwright/test";
import { joinRoom, newParticipant, newRoomCode } from "./support/session";

test("during a call, leaving the page asks first; moving in the app or after leaving the call does not", async ({
  browser,
}) => {
  const { page, context } = await newParticipant(browser, "Aviso Saida");
  try {
    const warnings: string[] = [];
    page.on("dialog", (dialog) => {
      warnings.push(dialog.type());
      // Staying on the page, as "Cancelar" does.
      void dialog.dismiss();
    });
    await joinRoom(page, await newRoomCode(), { micOn: false });

    // Inside the app the call goes on minimized: no question.
    await page.getByRole("button", { name: "Mais opções", exact: true }).click();
    await page
      .getByRole("dialog")
      .getByRole("link", { name: "Configurações", exact: true })
      .click();
    await page.getByRole("link", { name: "Voltar à chamada", exact: true }).click();
    await expect(page.getByRole("button", { name: "Sair da sala" })).toBeVisible();
    expect(warnings).toEqual([]);

    // Closing the tab (or reloading, or typing another address) would end the call.
    await page.close({ runBeforeUnload: true });
    await expect.poll(() => warnings).toEqual(["beforeunload"]);
    expect(page.isClosed()).toBe(false);
    await expect(page.getByRole("button", { name: "Sair da sala" })).toBeVisible();

    // Out of the call, the page leaves without asking.
    await page.getByRole("button", { name: "Sair da sala" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Sair", exact: true }).click();
    await expect(page.getByText("Você saiu da chamada")).toBeVisible();
    await page.close({ runBeforeUnload: true });
    await expect.poll(() => page.isClosed()).toBe(true);
    expect(warnings).toEqual(["beforeunload"]);
  } finally {
    await context.close();
  }
});

import { expect, test } from "@playwright/test";
import { ownedRoom } from "./support/database";
import { joinRoom, newParticipant } from "./support/session";

test("the owner's card for someone holds their sound for me and the actions as menu items", async ({
  browser,
}) => {
  const owner = await newParticipant(browser, "Dona Cartao");
  const guest = await newParticipant(browser, "Pessoa Cartao");
  try {
    const code = await ownedRoom(`e2e-${Date.now().toString(36)}-cartao`, owner.email);
    // A short window: the owner's card, with the sound and the moderation, is taller than it.
    await owner.page.setViewportSize({ width: 1280, height: 420 });
    await joinRoom(owner.page, code, { micOn: false });
    await joinRoom(guest.page, code, { micOn: false });

    await owner.page.getByRole("button", { name: "Ver Pessoa Cartao" }).first().click();
    const card = owner.page.getByRole("dialog", { name: "Pessoa Cartao" });
    await expect(card).toBeVisible();
    await expect(card.getByText("Na chamada", { exact: false })).toHaveCount(0);
    await expect(card.getByText("Microfone desligado")).toHaveCount(0);
    for (const action of [
      "Silenciar só para mim",
      "Restaurar volumes",
      "Adicionar amigo",
      "Tornar moderador",
      "Transferir a sala",
      "Denunciar",
      "Expulsar",
    ]) {
      await expect(card.getByRole("button", { name: action, exact: true })).toBeVisible();
    }

    const sound = card.getByRole("region", { name: "Som para você" });
    await expect(
      sound.getByRole("slider", { name: "Voz de Pessoa Cartao para você" }),
    ).toBeVisible();
    // The label already says what a click does, so the item is no pressed toggle.
    await expect(sound.getByRole("button", { name: "Silenciar só para mim" })).not.toHaveAttribute(
      "aria-pressed",
    );
    await expect(
      sound.getByRole("button", { name: "Silenciar só para mim" }),
    ).toHaveAccessibleDescription(
      "Você para de ouvir Pessoa Cartao. Os outros continuam ouvindo e ninguém é avisado.",
    );

    const expel = card.getByRole("button", { name: "Expulsar", exact: true });
    await expel.scrollIntoViewIfNeeded();
    await expect(expel).toBeInViewport();
    await expect
      .poll(() =>
        card.evaluate((panel) => panel.getBoundingClientRect().bottom <= window.innerHeight),
      )
      .toBe(true);

    await card.getByRole("button", { name: "Tornar moderador", exact: true }).click();
    await expect(card.getByText("Moderador", { exact: true })).toBeVisible();

    await card.getByRole("button", { name: "Transferir a sala", exact: true }).click();
    const confirm = card.getByRole("alertdialog", {
      name: "Transferir a sala para Pessoa Cartao?",
    });
    await expect(confirm).toContainText("Você continua moderando.");
    await confirm.getByRole("button", { name: "Cancelar", exact: true }).click();

    // On my own card, only who I am.
    await owner.page.keyboard.press("Escape");
    await owner.page.getByRole("button", { name: "Ver Dona Cartao" }).first().click();
    const mine = owner.page.getByRole("dialog", { name: "Dona Cartao" });
    await expect(mine.getByText("Você · Dono", { exact: true })).toBeVisible();
    await expect(mine.getByText("Som para você")).toHaveCount(0);
  } finally {
    await Promise.all([owner.context.close(), guest.context.close()]);
  }
});

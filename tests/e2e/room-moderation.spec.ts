import { expect, test } from "@playwright/test";
import { joinRoom, newParticipant, newVisitor } from "./support/session";
import { E2E_ACCESS_PASSWORD, E2E_URL } from "./support/env";

test("promotion and demotion update entry controls and requests during the call", async ({
  browser,
}) => {
  const owner = await newParticipant(browser, "Ana Dona");
  const moderator = await newParticipant(browser, "Bia Agora Mod");
  const visitor = await newVisitor(browser);
  try {
    await owner.page.goto("/");
    await owner.page.getByRole("button", { name: "Criar sala", exact: true }).first().click();
    await expect(owner.page).toHaveURL(/\/sala\/[a-z0-9-]+$/);
    const code = new URL(owner.page.url()).pathname.split("/")[2];
    if (!code) throw new Error("Room code missing");
    await joinRoom(owner.page, code, { micOn: false });
    await joinRoom(moderator.page, code, { micOn: false });

    const managerButton = moderator.page.getByRole("button", { name: /^Entrada da sala:/ });
    await expect(managerButton).toHaveCount(0);
    await owner.page.getByRole("button", { name: /^Entrada da sala:/ }).click();
    const accessSaved = owner.page.waitForResponse(/\/api\/operations\/room-setRoomAccess/);
    await owner.page.getByRole("button", { name: /Com aprovação/ }).click();
    expect((await accessSaved).ok()).toBe(true);
    await expect(
      owner.page.getByRole("button", { name: "Entrada da sala: Com aprovação. Mudar" }),
    ).toBeVisible();

    const request = await visitor.context.request.post("/api/token", {
      headers: { origin: E2E_URL },
      data: { room: code, guestName: "Visita Esperando", password: E2E_ACCESS_PASSWORD },
    });
    expect(request.status()).toBe(202);
    await expect(owner.page.getByRole("region", { name: "Pedidos para entrar" })).toBeVisible();

    await owner.page.getByRole("button", { name: "Ver Bia Agora Mod", exact: true }).click();
    await owner.page.getByRole("button", { name: "Tornar moderador", exact: true }).click();
    await expect(owner.page.getByText("Bia Agora Mod agora modera a sala.")).toBeVisible();
    await owner.page.keyboard.press("Escape");

    const pending = moderator.page.getByRole("region", { name: "Pedidos para entrar" });
    await expect(pending).toContainText("Visita Esperando");
    await expect(managerButton).toHaveText("Com aprovação");
    await pending.getByRole("button", { name: "Aceitar", exact: true }).click();
    await expect(pending).toBeHidden();

    // A second pending request must disappear from the former moderator on demotion.
    await visitor.context.request.post("/api/token", {
      headers: { origin: E2E_URL },
      data: { room: code, guestName: "Visita Esperando", password: E2E_ACCESS_PASSWORD },
    });
    await visitor.context.request.post("/api/token", {
      headers: { origin: E2E_URL },
      data: { room: code, guestName: "Visita Esperando", password: E2E_ACCESS_PASSWORD },
    });
    await expect(pending).toBeVisible();
    await owner.page.getByRole("button", { name: "Ver Bia Agora Mod", exact: true }).click();
    await owner.page.getByRole("button", { name: "Tirar moderador", exact: true }).click();
    await expect(managerButton).toHaveCount(0);
    await expect(pending).toBeHidden();
  } finally {
    await owner.context.close();
    await moderator.context.close();
    await visitor.context.close();
  }
});

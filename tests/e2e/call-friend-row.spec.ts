import { expect, test } from "@playwright/test";
import { sql } from "./support/database";
import { joinRoom, newParticipant, newRoomCode } from "./support/session";

test("the empty room's invite card opens a window to search friends and call them", async ({
  browser,
}) => {
  const host = await newParticipant(browser, "Anfitriao Linha");
  const friend = await newParticipant(browser, "Amiga Linha");
  try {
    await sql(
      `insert into friendships (user_low_id, user_high_id, requested_by, status, accepted_at)
      select least(a.id, b.id), greatest(a.id, b.id), a.id, 'accepted', now()
      from users a, users b where a.email = $1 and b.email = $2`,
      [host.email, friend.email],
    );
    // Online only once the friend's page holds its live connection.
    const live = friend.page.waitForResponse("**/api/eventos**");
    await friend.page.goto("/inicio");
    await live;
    await joinRoom(host.page, await newRoomCode(), { micOn: false });

    const invite = host.page.getByRole("region", { name: "Chamar pessoas" });
    const call = invite.getByRole("button", { name: "Chamar amigos" });
    // Below the link and as wide as its row, not a tag in the corner.
    const link = await invite.getByLabel("Link da sala").boundingBox();
    const row = await call.boundingBox();
    if (link === null || row === null) throw new Error("The invite card was not laid out.");
    expect(row.y).toBeGreaterThanOrEqual(link.y + link.height);
    expect(row.x).toBeLessThanOrEqual(link.x + 1);

    await call.click();
    const window = host.page.getByRole("dialog", { name: "Chamar amigos" });
    const list = window.getByRole("list", { name: "Amigos para chamar" });
    await expect(list.getByText("Amiga Linha")).toBeVisible({ timeout: 15_000 });
    const search = window.getByRole("searchbox", { name: "Buscar amigo" });
    await search.fill("ninguem");
    await expect(window.getByText("Nenhum amigo com esse nome.")).toBeVisible();

    await search.fill("amiga");
    await list.getByText("Amiga Linha").click();
    await window.getByRole("button", { name: "Chamar", exact: true }).click();
    await expect(window).toBeHidden();
  } finally {
    await host.context.close();
    await friend.context.close();
  }
});

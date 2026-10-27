import { expect, test } from "@playwright/test";
import { sql } from "./support/database";
import { joinRoom, newParticipant, newRoomCode } from "./support/session";

test("a friend called while offline finds a missed call in the conversation", async ({
  browser,
}) => {
  const host = await newParticipant(browser, "Gui Perdida");
  // Signed up through the API and no page opened yet: Offline.
  const friend = await newParticipant(browser, "Bia Perdida");
  try {
    await sql(
      `insert into friendships (user_low_id, user_high_id, requested_by, status, accepted_at)
      select least(a.id, b.id), greatest(a.id, b.id), a.id, 'accepted', now()
      from users a, users b where a.email = $1 and b.email = $2`,
      [host.email, friend.email],
    );
    await joinRoom(host.page, await newRoomCode(), { micOn: false });

    await host.page
      .getByRole("region", { name: "Chamar pessoas" })
      .getByRole("button", { name: "Chamar amigos" })
      .click();
    const window = host.page.getByRole("dialog", { name: "Chamar amigos" });
    const offline = window.getByRole("list", { name: "Offline" });
    await expect(offline.getByText("Vê quando abrir o Nelcota")).toBeVisible();
    await offline.getByText("Bia Perdida").click();
    await window.getByRole("button", { name: "Chamar", exact: true }).click();
    await expect(
      host.page.getByText("Quem está offline vê a chamada quando abrir o Nelcota."),
    ).toBeVisible();

    // Later, Bia opens the Nelcota: the conversation is unread and holds the call.
    await friend.page.goto("/inicio");
    await expect(friend.page.getByLabel("Gui Perdida, 1 mensagem nova")).toBeVisible();
    const hostRow = await sql("select id from users where email = $1", [host.email]);
    const hostRows: unknown[] = hostRow.rows;
    const first = hostRows[0];
    const hostId = typeof first === "object" && first !== null && "id" in first ? first.id : null;
    if (typeof hostId !== "string") throw new Error("The host was not saved.");
    await friend.page.goto(`/amigos/${hostId}/conversa`);
    await expect(friend.page.getByText("Chamada perdida")).toBeVisible();
    await expect(friend.page.getByText("Gui te chamou para uma sala")).toBeVisible();
  } finally {
    await host.context.close();
    await friend.context.close();
  }
});

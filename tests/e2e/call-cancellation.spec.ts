import { expect, test } from "@playwright/test";
import { sql } from "./support/database";
import { joinRoom, newParticipant, newRoomCode } from "./support/session";

test("cancelling an optimistic call stops a ring created by a delayed request", async ({
  browser,
}) => {
  const caller = await newParticipant(browser, "Caller Race");
  const callee = await newParticipant(browser, "Callee Race");
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  try {
    await sql(
      `insert into friendships (user_low_id, user_high_id, requested_by, status, accepted_at)
      select least(a.id, b.id), greatest(a.id, b.id), a.id, 'accepted', now()
      from users a, users b where a.email = $1 and b.email = $2`,
      [caller.email, callee.email],
    );
    await callee.page.goto("/inicio");
    await joinRoom(caller.page, await newRoomCode(), { micOn: false });
    await caller.page
      .getByRole("navigation", { name: "Sala", exact: true })
      .getByRole("link", { name: "Nelcota, início", exact: true })
      .click();
    await caller.page.getByRole("link", { name: "Callee Race", exact: true }).first().click();
    await caller.page.route("**/api/operations/ringing-callFriend", async (route) => {
      await gate;
      const response = await route.fetch();
      const body = (await response.json()) as { data?: { ringId?: string } };
      expect(body.data?.ringId).toEqual(expect.any(String));
      await route.fulfill({ response });
    });
    await caller.page
      .getByRole("main")
      .getByRole("button", { name: "Chamar Callee", exact: true })
      .click();
    await caller.page
      .getByRole("main")
      .getByRole("button", { name: "Chamando Callee. Cancelar", exact: true })
      .click();
    const cancelled = caller.page.waitForResponse("**/api/operations/ringing-cancelCall");
    release();
    expect((await cancelled).ok()).toBe(true);
    await expect(
      callee.page.getByRole("alertdialog", { name: "Caller Race está te chamando" }),
    ).toHaveCount(0);
    await expect(
      caller.page.getByRole("main").getByRole("button", { name: "Chamar Callee", exact: true }),
    ).toBeVisible();
  } finally {
    release();
    await caller.page.unrouteAll({ behavior: "ignoreErrors" });
    await Promise.all([caller.context.close(), callee.context.close()]);
  }
});

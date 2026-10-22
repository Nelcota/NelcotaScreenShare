import { expect, test } from "@playwright/test";
import { joinRoom, newParticipant, newRoomCode } from "./support/session";

test("signed in, the friends column stays on the room's screens, as the rail in the call", async ({
  browser,
}) => {
  const { page, context } = await newParticipant(browser, "Coluna Sala");
  try {
    const code = await newRoomCode();
    await page.goto(`/sala/${code}`);
    const column = page.getByRole("complementary", { name: "Amigos" });
    await expect(column).toBeVisible();
    await expect(column.getByRole("button", { name: "Recolher amigos" })).toBeVisible();
    // On a short window the panel scrolls, and its top is not cut off.
    await page.setViewportSize({ width: 800, height: 600 });
    const heading = page.getByRole("heading", { name: "Tudo certo para entrar?" });
    // The focused field may have scrolled the panel down: scrolling back must reach the title.
    await heading.scrollIntoViewIfNeeded();
    const panelTop = (await page.getByRole("main").boundingBox())?.y ?? 0;
    expect((await heading.boundingBox())?.y ?? -1).toBeGreaterThan(panelTop);
    await page.setViewportSize({ width: 1280, height: 720 });
    await expect(page.getByRole("link", { name: "Voltar ao início" })).toHaveAttribute(
      "href",
      "/inicio",
    );

    await joinRoom(page, code, { micOn: false });
    // In the call the column starts as the rail, and opens on request.
    await expect(column.getByRole("button", { name: "Abrir amigos" })).toBeVisible();
    await column.getByRole("button", { name: "Abrir amigos" }).click();
    await expect(column.getByRole("button", { name: "Recolher amigos" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Sair da sala", exact: true })).toBeVisible();
  } finally {
    await context.close();
  }
});

test("the column's status menu signs out, also with reduced motion", async ({ browser }) => {
  const { page, context } = await newParticipant(browser, "Coluna Saida");
  try {
    // Without the closing animation the menu unmounts at once: the form must still submit.
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/inicio");
    const column = page.getByRole("complementary", { name: "Amigos" });
    await column.getByRole("button", { name: /^Seu status:/ }).click();
    await page.getByRole("menuitem", { name: "Sair da conta", exact: true }).click();
    await expect(page).toHaveURL(/\/entrar\?aviso=saiu$/);
    await page.goto("/inicio");
    await expect(page).toHaveURL(/\/entrar/);
  } finally {
    await context.close();
  }
});

test("a guest's pre-join keeps the plain header, without the column", async ({ browser }) => {
  const context = await browser.newContext({ locale: "pt-BR" });
  const page = await context.newPage();
  try {
    await page.goto(`/sala/${await newRoomCode()}`);
    await expect(page.getByRole("heading", { name: "Tudo certo para entrar?" })).toBeVisible();
    await expect(page.getByRole("complementary", { name: "Amigos" })).toHaveCount(0);
  } finally {
    await context.close();
  }
});

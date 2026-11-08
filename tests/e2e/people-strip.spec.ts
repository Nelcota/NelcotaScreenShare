import { expect, test, type Browser, type Locator } from "@playwright/test";
import { fakeScreenCapture } from "./support/screen-capture";
import { joinRoom, newParticipant, newRoomCode } from "./support/session";

/** The size of the window in the report: the column left the screen small. */
const SMALL_WINDOW = { width: 1030, height: 844 };
const PHONE = { width: 375, height: 812 };

async function widthOf(element: Locator): Promise<number> {
  return (await element.boundingBox())?.width ?? 0;
}

/** Someone shares a screen and the viewer, in a small window, watches it. */
async function watchSharedScreen(browser: Browser) {
  const sharer = await newParticipant(browser, "Quem Mostra");
  const viewer = await newParticipant(browser, "Quem Assiste");
  await fakeScreenCapture(sharer.page);
  const code = await newRoomCode();
  await joinRoom(sharer.page, code);
  await viewer.page.setViewportSize(SMALL_WINDOW);
  await joinRoom(viewer.page, code);
  await sharer.page.getByRole("button", { name: "Compartilhar tela", exact: true }).click();
  await sharer.page.getByRole("button", { name: /^Tela inteira/ }).click();
  await viewer.page.getByRole("button", { name: "Assistir à tela de Quem Mostra" }).click();
  const screen = viewer.page.getByRole("region", { name: "Tela compartilhada por Quem Mostra" });
  await expect(screen).toBeVisible();
  const people = viewer.page.locator("[data-mascot-participants]");
  const close = async () => {
    await sharer.context.close();
    await viewer.context.close();
  };
  return { page: viewer.page, screen, people, close };
}

/** In a small window the people beside the screen took a fixed column and the screen shrank. */
test("shrinking the people beside a shared screen gives the screen room", async ({ browser }) => {
  const call = await watchSharedScreen(browser);
  const before = await widthOf(call.screen);

  await call.page.getByRole("button", { name: "Encolher a lista de pessoas" }).click();

  await expect.poll(() => widthOf(call.screen)).toBeGreaterThan(before + 100);
  expect(await widthOf(call.people)).toBeLessThan(100);
  expect(await call.page.evaluate(() => localStorage.getItem("nelcota-people-strip"))).toBe(
    "shrunk",
  );
  await call.close();
});

test("showing the names again brings the column back", async ({ browser }) => {
  const call = await watchSharedScreen(browser);
  await call.page.getByRole("button", { name: "Encolher a lista de pessoas" }).click();

  await call.page.getByRole("button", { name: "Mostrar os nomes" }).click();

  await expect.poll(() => widthOf(call.people)).toBeGreaterThan(200);
  await call.close();
});

test("on a phone the people stay in a row with names, even after shrinking", async ({
  browser,
}) => {
  const call = await watchSharedScreen(browser);
  await call.page.getByRole("button", { name: "Encolher a lista de pessoas" }).click();

  await call.page.setViewportSize(PHONE);

  await expect(call.page.getByRole("button", { name: "Mostrar os nomes" })).toHaveCount(0);
  // A hidden name still has a 1 px box (it stays for screen readers), so measure it.
  await expect
    .poll(() => widthOf(call.people.getByText("Quem Mostra").first()))
    .toBeGreaterThan(30);
  await call.close();
});

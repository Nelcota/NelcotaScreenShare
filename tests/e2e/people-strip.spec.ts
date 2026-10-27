import { expect, test, type Locator } from "@playwright/test";
import { fakeScreenCapture } from "./support/screen-capture";
import { joinRoom, newParticipant, newRoomCode } from "./support/session";

async function widthOf(element: Locator): Promise<number> {
  return (await element.boundingBox())?.width ?? 0;
}

/** In a small window the people beside the screen took a fixed column and the screen shrank. */
test("the people beside a shared screen shrink to their photos and give the screen room", async ({
  browser,
}) => {
  const sharer = await newParticipant(browser, "Quem Mostra");
  const viewer = await newParticipant(browser, "Quem Assiste");
  await fakeScreenCapture(sharer.page);
  const code = await newRoomCode();
  await joinRoom(sharer.page, code);
  await viewer.page.setViewportSize({ width: 1030, height: 844 });
  await joinRoom(viewer.page, code);
  await sharer.page.getByRole("button", { name: "Compartilhar tela", exact: true }).click();
  await sharer.page.getByRole("button", { name: /^Tela inteira/ }).click();
  await viewer.page.getByRole("button", { name: "Assistir à tela de Quem Mostra" }).click();
  const screen = viewer.page.getByRole("region", { name: "Tela compartilhada por Quem Mostra" });
  await expect(screen).toBeVisible();
  const people = viewer.page.locator("[data-mascot-participants]");
  const before = await widthOf(screen);

  await viewer.page.getByRole("button", { name: "Encolher a lista de pessoas" }).click();

  await expect.poll(() => widthOf(screen)).toBeGreaterThan(before + 100);
  expect(await widthOf(people)).toBeLessThan(100);
  expect(await viewer.page.evaluate(() => localStorage.getItem("nelcota-people-strip"))).toBe(
    "shrunk",
  );

  await viewer.page.getByRole("button", { name: "Mostrar os nomes" }).click();

  await expect.poll(() => widthOf(people)).toBeGreaterThan(200);
  await sharer.context.close();
  await viewer.context.close();
});

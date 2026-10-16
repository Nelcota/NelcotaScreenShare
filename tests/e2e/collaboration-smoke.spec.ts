import { expect, test, type Page } from "@playwright/test";
import { newParticipant, joinRoom, newRoomCode, setJoinMicrophone } from "./support/session";
import { E2E_ACCESS_PASSWORD } from "./support/env";
import { fakeScreenCapture } from "./support/screen-capture";
import { keyboardMark } from "./support/annotations";

test.skip(
  process.env.E2E_HOST_CONTROLS !== "true",
  "Requires private admission and annotation state",
);

async function watchScreen(page: Page, sharer: string) {
  await page.getByRole("button", { name: `Assistir à tela de ${sharer}` }).click();
}

test("five participants, two screens, three annotators and an empty newcomer state", async ({
  browser,
}) => {
  test.setTimeout(120_000);
  const people = [];
  const joinsMs: number[] = [];
  try {
    for (let index = 0; index < 5; index += 1)
      people.push(await newParticipant(browser, `Carga Pessoa ${index + 1}`));
    const [host, second, firstWriter, secondWriter, newcomer] = people;
    if (!host || !second || !firstWriter || !secondWriter || !newcomer)
      throw new Error("Participants missing");
    await fakeScreenCapture(host.page);
    await fakeScreenCapture(second.page);
    const code = await newRoomCode();
    for (const person of people.slice(0, 4)) {
      const before = Date.now();
      await joinRoom(person.page, code);
      joinsMs.push(Date.now() - before);
    }
    for (const person of [host, second]) {
      await person.page.getByRole("button", { name: "Compartilhar tela", exact: true }).click();
      await person.page.getByRole("button", { name: /^Tela inteira/ }).click();
    }
    // A shared screen waits for "Assistir" (watch to view); the presenter sees their own.
    for (const person of [firstWriter, secondWriter]) await watchScreen(person.page, host.name);
    for (const person of [host, firstWriter, secondWriter])
      await expect(person.page.getByRole("button", { name: "Anotar na tela" })).toBeVisible();
    // The newcomer waits on the pre-join: only the click and the connection fit in the marks'
    // 10 s life, so the mark is still there to not be shown to them (under load, a whole
    // join did not fit, and the mark expired before the count).
    await newcomer.page.goto(`/sala/${code}`);
    await setJoinMicrophone(newcomer.page, true);
    await newcomer.page.getByLabel("Senha da sala").fill(E2E_ACCESS_PASSWORD);
    await keyboardMark(firstWriter.page, "Seta");
    await expect(host.page.locator("[data-annotation]")).toHaveCount(1);
    const before = Date.now();
    await newcomer.page.getByRole("button", { name: /Entrar na sala|Entrar só ouvindo/ }).click();
    await expect(newcomer.page.getByRole("button", { name: /Sair/ })).toBeVisible();
    joinsMs.push(Date.now() - before);
    await watchScreen(newcomer.page, host.name);
    await expect(newcomer.page.getByRole("button", { name: "Anotar na tela" })).toBeVisible();
    await expect(newcomer.page.locator("[data-annotation]")).toHaveCount(0);
    await expect(host.page.locator("[data-annotation]")).toHaveCount(1);
    await host.page.getByRole("button", { name: "Anotar na tela" }).click();
    await host.page.getByRole("button", { name: "Limpar anotações de todos" }).click();
    await expect(firstWriter.page.locator("[data-annotation]")).toHaveCount(0);
    await host.page.keyboard.press("Escape");
    for (const person of [firstWriter, secondWriter, newcomer])
      await keyboardMark(person.page, "Círculo");
    await expect(host.page.locator("[data-annotation]")).toHaveCount(3);
    for (const person of people)
      await expect(person.page.getByRole("button", { name: /5 pessoas/ })).toBeVisible();
    await test.info().attach("collaboration-smoke-metrics", {
      body: JSON.stringify({
        participants: 5,
        simultaneousScreens: 2,
        annotators: 3,
        joinsMs,
        capture: "synthetic canvas and microphone",
        browser: "Chromium",
      }),
      contentType: "application/json",
    });
  } finally {
    await Promise.all(people.map((person) => person.context.close()));
  }
});

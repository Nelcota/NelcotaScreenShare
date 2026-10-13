import { expect, test } from "@playwright/test";
import { newParticipant, joinRoom, newRoomCode } from "./support/session";
import { fakeScreenCapture } from "./support/screen-capture";
import { keyboardMark } from "./support/annotations";

test.skip(
  process.env.E2E_HOST_CONTROLS !== "true",
  "Requires private admission and annotation state",
);

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
    for (const person of [host, firstWriter, secondWriter]) {
      const picker = person.page.getByRole("group", { name: "Escolher a tela compartilhada" });
      await picker
        .getByRole("button", { name: person === host ? "Você" : host.name, exact: true })
        .click();
      await expect(person.page.getByRole("button", { name: "Anotar na tela" })).toBeVisible();
    }
    await keyboardMark(firstWriter.page, "Seta");
    await expect(host.page.locator("[data-annotation]")).toHaveCount(1);
    const before = Date.now();
    await joinRoom(newcomer.page, code);
    joinsMs.push(Date.now() - before);
    await newcomer.page
      .getByRole("group", { name: "Escolher a tela compartilhada" })
      .getByRole("button", { name: host.name, exact: true })
      .click();
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

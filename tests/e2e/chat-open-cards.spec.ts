import { expect, test, type Page } from "@playwright/test";
import { joinRoom, newParticipant, newRoomCode } from "./support/session";
import { fakeScreenCapture } from "./support/screen-capture";

interface Frame {
  overlap: number;
  pastRight: number;
}

/** Every frame for a while: how much the cards cover each other and pass the free area. */
async function watchCards(page: Page, milliseconds: number): Promise<Frame[]> {
  return page.evaluate(async (duration) => {
    const frames: { overlap: number; pastRight: number }[] = [];
    const chat = document.querySelector("[aria-label='Chat da sala']");
    const end = performance.now() + duration;
    while (performance.now() < end) {
      await new Promise(requestAnimationFrame);
      const cards = [...document.querySelectorAll("[data-flip-id^='tile-']")].map((card) =>
        card.getBoundingClientRect(),
      );
      const [first, second] = cards;
      const free = chat?.getBoundingClientRect().left ?? window.innerWidth;
      if (!first || !second) continue;
      const width = Math.min(first.right, second.right) - Math.max(first.left, second.left);
      const height = Math.min(first.bottom, second.bottom) - Math.max(first.top, second.top);
      frames.push({
        overlap: Math.max(0, width) * Math.max(0, height),
        pastRight: Math.max(0, ...cards.map((card) => card.right - free)),
      });
    }
    return frames;
  }, milliseconds);
}

test("opening the chat moves the cards aside without stacking them or leaving the screen", async ({
  browser,
}) => {
  const first = await newParticipant(browser, "Cartao Um");
  const second = await newParticipant(browser, "Cartao Dois");
  try {
    await first.page.setViewportSize({ width: 1440, height: 900 });
    const code = await newRoomCode();
    await joinRoom(first.page, code, { micOn: false });
    await joinRoom(second.page, code, { micOn: false });
    await expect(first.page.locator("[data-flip-id^='tile-']")).toHaveCount(2);
    // The entrance of the second card has to end before measuring.
    await first.page.waitForTimeout(1500);

    for (const label of ["open", "close", "open again"]) {
      await first.page.getByRole("button", { name: /^Chat/ }).click();
      const frames = await watchCards(first.page, 900);
      expect(frames.length, label).toBeGreaterThan(10);
      expect(Math.max(...frames.map((frame) => frame.overlap)), `${label}: overlap`).toBe(0);
      if (label !== "close")
        expect(Math.max(...frames.map((frame) => frame.pastRight)), `${label}: past the chat`).toBe(
          0,
        );
    }
  } finally {
    await first.context.close();
    await second.context.close();
  }
});

/** The lowest opacity the stage shows while the chat opens: it resizes, never blinks. */
async function lowestStageOpacity(page: Page, milliseconds: number): Promise<number> {
  return page.evaluate(async (duration) => {
    const stage = document.querySelector("[data-flip-id='stage']");
    if (!stage) return 0;
    let lowest = 1;
    const end = performance.now() + duration;
    while (performance.now() < end) {
      await new Promise(requestAnimationFrame);
      lowest = Math.min(lowest, Number(getComputedStyle(stage).opacity));
    }
    return lowest;
  }, milliseconds);
}

test("with a screen on the stage, opening the chat never makes the screen blink", async ({
  browser,
}) => {
  const sharer = await newParticipant(browser, "Mostra Palco");
  const viewer = await newParticipant(browser, "Ve Palco");
  try {
    await fakeScreenCapture(sharer.page);
    await viewer.page.setViewportSize({ width: 1440, height: 900 });
    const code = await newRoomCode();
    await joinRoom(sharer.page, code, { micOn: false });
    await joinRoom(viewer.page, code, { micOn: false });
    await sharer.page.getByRole("button", { name: "Compartilhar tela", exact: true }).click();
    await sharer.page.getByRole("button", { name: /^Tela inteira/ }).click();
    await viewer.page.getByRole("button", { name: "Assistir à tela de Mostra Palco" }).click();
    await expect(viewer.page.getByLabel("Tela de Mostra Palco")).toBeVisible();
    await viewer.page.waitForTimeout(1500);

    await viewer.page.getByRole("button", { name: /^Chat/ }).click();
    expect(await lowestStageOpacity(viewer.page, 900)).toBeGreaterThan(0.99);
  } finally {
    await sharer.context.close();
    await viewer.context.close();
  }
});

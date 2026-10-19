import { expect, test, type Page } from "@playwright/test";
import { joinRoom, newParticipant, newRoomCode } from "./support/session";

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

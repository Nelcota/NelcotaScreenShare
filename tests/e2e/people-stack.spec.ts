import { expect, test } from "@playwright/test";
import { joinRoom, newParticipant, newRoomCode } from "./support/session";

/** A see-through fill lets the face underneath show inside the initials. */
function isSeeThrough(color: string): boolean {
  return color === "transparent" || /\/\s*0?\.\d+\)|rgba\([^)]*,\s*0?\.\d+\)/.test(color);
}

test("the faces stacked at the top bar are opaque, so they never show each other through", async ({
  browser,
}) => {
  const ana = await newParticipant(browser, "Ana Pilha");
  const rafa = await newParticipant(browser, "Rafa Pilha");
  try {
    const code = await newRoomCode();
    await joinRoom(ana.page, code, { micOn: false });
    await joinRoom(rafa.page, code, { micOn: false });
    const stack = ana.page
      .getByText("2 pessoas", { exact: true })
      .locator("xpath=preceding-sibling::span[1]");
    await expect(stack.locator(":scope > span")).toHaveCount(2);

    const fills = await stack
      .locator(":scope > span")
      .evaluateAll((faces) => faces.map((face) => getComputedStyle(face).backgroundColor));

    expect(fills.filter(isSeeThrough)).toEqual([]);
  } finally {
    await ana.context.close();
    await rafa.context.close();
  }
});

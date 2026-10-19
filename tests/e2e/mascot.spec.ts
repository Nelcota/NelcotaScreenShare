import { expect, test } from "@playwright/test";
import { newVisitor } from "./support/session";

/**
 * Observable mascot behavior (data-expression on the root), locked in before
 * refactoring the engine (use-mascot). The clock is controlled by the test.
 */
test("falls asleep without activity and wakes up when the person types", async ({ browser }) => {
  const { page, context } = await newVisitor(browser);
  await page.clock.install();
  await page.goto("/entrar");
  const mascot = page.locator("[data-expression]").first();
  await expect(mascot).toBeVisible();

  // Advance in steps: a quirk (sneeze) along the way resets the sleep countdown.
  await expect
    .poll(
      async () => {
        await page.clock.fastForward(15_000);
        return mascot.getAttribute("data-expression");
      },
      { timeout: 30_000, intervals: [100] },
    )
    .toBe("asleep");

  await page.getByLabel("E-mail").pressSequentially("ana@");
  await page.clock.fastForward(1_000);
  await expect(mascot).not.toHaveAttribute("data-expression", /asleep|sleepy/);
  await context.close();
});

test("an invalid code on the home page makes the mascot grumpy, then it calms down", async ({
  browser,
}) => {
  const { page, context } = await newVisitor(browser);
  await page.clock.install();
  await page.goto("/");
  const input = page.getByPlaceholder("Link ou código da sala").first();
  await input.fill("!!");
  await input.press("Enter");
  const grumpy = page.locator('[data-expression="grumpy"]');
  await expect(grumpy.first()).toBeVisible();
  await page.clock.fastForward(10_000);
  await expect(grumpy).toHaveCount(0);
  await context.close();
});

test("the original mascot and headphone companion meet and return to rest", async ({
  browser,
}, info) => {
  const { page, context } = await newVisitor(browser);
  try {
    await page.setViewportSize({ width: 1440, height: 960 });
    await page.goto("/");
    const pair = page.locator("[data-mascot-pair]").first();
    const curious = pair.locator('[data-temperament="curious"]');
    const companion = pair.locator('[data-temperament="calm"]');
    await expect(pair).toHaveAttribute("data-positioned", "true");
    await expect(curious.locator("[data-mascot-accessory]")).toHaveCount(0);
    await expect(companion.locator('[data-mascot-accessory="headphones"]')).toHaveCount(1);
    await page.mouse.move(20, 200);
    await page.evaluate(() => {
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    });
    const originalCurious = await curious.boundingBox();
    const originalCompanion = await companion.boundingBox();
    expect(originalCurious).not.toBeNull();
    expect(originalCompanion).not.toBeNull();

    await expect(pair).toHaveAttribute("data-phase", "approach", { timeout: 20_000 });
    await expect(curious).toHaveAttribute("data-expression", "walking");
    await expect
      .poll(async () => (await curious.boundingBox())?.x ?? -Infinity)
      .toBeGreaterThan(originalCurious!.x + 10);
    await expect
      .poll(async () => (await companion.boundingBox())?.x ?? Infinity)
      .toBeLessThan(originalCompanion!.x - 10);
    // Observe every frame: the contact pose is shorter than assertion retry intervals.
    await page.waitForFunction(
      () => document.querySelector("[data-mascot-pair]")?.getAttribute("data-phase") === "hit",
      null,
      { timeout: 10_000 },
    );
    await expect(curious).toHaveAttribute("data-expression", "greeting");
    await expect(pair).toHaveAttribute("data-phase", "rest");
    expect((await curious.boundingBox())!.x).toBeCloseTo(originalCurious!.x, 1);
    expect((await companion.boundingBox())!.x).toBeCloseTo(originalCompanion!.x, 1);
    await pair.screenshot({ path: info.outputPath("mascot-pair-desktop.png") });

    await page.emulateMedia({ reducedMotion: "reduce" });
    await expect(pair).toHaveAttribute("data-suspended", "true");
    await page.setViewportSize({ width: 375, height: 812 });
    await pair.scrollIntoViewIfNeeded();
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
      .toBe(true);
    await expect(curious).toBeVisible();
    await expect(companion).toBeVisible();
    await pair.screenshot({ path: info.outputPath("mascot-pair-mobile.png") });
  } finally {
    await context.close();
  }
});

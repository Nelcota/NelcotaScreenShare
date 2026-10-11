import { expect, test } from "@playwright/test";
import { newVisitor } from "./support/session";

test("browser cards reveal smoothly and remain readable with reduced motion", async ({
  browser,
}) => {
  const { page, context } = await newVisitor(browser);
  await page.goto("/");
  const cards = page.getByRole("list", { name: "O que cada navegador faz na sala" });
  await cards.scrollIntoViewIfNeeded();
  await expect
    .poll(() => cards.evaluate((element) => Number(getComputedStyle(element).opacity)))
    .toBeGreaterThan(0.9);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 320, height: 740 });
  await cards.scrollIntoViewIfNeeded();
  await expect
    .poll(() => cards.evaluate((element) => Number(getComputedStyle(element).opacity)))
    .toBe(1);
  const cardBounds = await cards.evaluate((element) => {
    const bounds = element.getBoundingClientRect();
    return { left: bounds.left, right: bounds.right, viewport: window.innerWidth };
  });
  expect(cardBounds.left).toBeGreaterThanOrEqual(0);
  expect(cardBounds.right).toBeLessThanOrEqual(cardBounds.viewport);
  await context.close();
});

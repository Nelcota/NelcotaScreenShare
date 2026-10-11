import { expect, test } from "@playwright/test";
import { newVisitor } from "./support/session";

test("Brave has a loaded logo and appears in the supported browser card", async ({ browser }) => {
  const { page, context } = await newVisitor(browser);
  await page.goto("/");
  const cards = page.getByRole("list", { name: "O que cada navegador faz na sala" });
  await cards.scrollIntoViewIfNeeded();
  const brave = cards.locator('img[src="/browsers/brave.svg"]');
  await expect(brave).toBeVisible();
  await expect
    .poll(() => brave.evaluate((image: HTMLImageElement) => image.naturalWidth))
    .toBeGreaterThan(0);
  await expect(
    cards.getByText("Chrome, Edge, Brave e outros Chromium", { exact: true }),
  ).toBeVisible();
  await context.close();
});

import { expect, type Page } from "@playwright/test";
export async function keyboardMark(page: Page, tool: "Seta" | "Círculo" | "Caneta") {
  await page.getByRole("button", { name: "Anotar na tela" }).click();
  await page.getByRole("button", { name: tool, exact: true }).click();
  const layer = page.getByRole("button", { name: /Anotações temporárias/ });
  await expect(layer).toBeFocused();
  await layer.press("Enter");
  await layer.press("ArrowRight");
  await layer.press("ArrowRight");
  await layer.press("ArrowDown");
  await layer.press("Enter");
}

export async function annotationBounds(page: Page) {
  await expect
    .poll(async () => {
      const expected = await page
        .locator("video")
        .first()
        .evaluate((element) => {
          if (!(element instanceof HTMLVideoElement)) throw new Error("Video missing");
          const rect = element.getBoundingClientRect();
          const scale = Math.min(
            rect.width / element.videoWidth,
            rect.height / element.videoHeight,
          );
          const width = element.videoWidth * scale;
          const height = element.videoHeight * scale;
          return {
            left: rect.left + (rect.width - width) / 2,
            top: rect.top + (rect.height - height) / 2,
            width,
            height,
          };
        });
      const actual = await page
        .getByRole("button", { name: /Anotações temporárias/ })
        .boundingBox();
      if (!actual) return Infinity;
      return Math.max(
        Math.abs(actual.x - expected.left),
        Math.abs(actual.y - expected.top),
        Math.abs(actual.width - expected.width),
        Math.abs(actual.height - expected.height),
      );
    })
    .toBeLessThan(2);
}

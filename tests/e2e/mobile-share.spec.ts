import { expect, test, type Page } from "@playwright/test";
import { fakeScreenCapture } from "./support/screen-capture";
import { joinRoom, newParticipant, newRoomCode } from "./support/session";

const ANDROID =
  "Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36";
const IPHONE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/27.0 Mobile/15E148 Safari/604.1";

/**
 * The page sees a phone: its user agent, touch and, where its browser cannot share, no
 * screen picker (Android today). Chromium underneath still captures for the iPhone case.
 */
async function asPhone(page: Page, userAgent: string, { picker }: { picker: boolean }) {
  await page.addInitScript(
    ({ agent, keepPicker }) => {
      Object.defineProperty(navigator, "userAgent", { get: () => agent });
      Object.defineProperty(navigator, "userAgentData", { get: () => ({ mobile: true }) });
      Object.defineProperty(navigator, "maxTouchPoints", { get: () => 5 });
      if (!keepPicker) Reflect.deleteProperty(MediaDevices.prototype, "getDisplayMedia");
    },
    { agent: userAgent, keepPicker: picker },
  );
}

function callControls(page: Page) {
  return page.getByRole("navigation", { name: "Controles da chamada", exact: true });
}

async function expectDockFits(page: Page, width: number) {
  await page.setViewportSize({ width, height: 812 });
  const bounds = await callControls(page).boundingBox();
  if (bounds === null) throw new Error(`The call controls have no box at ${width}px`);
  expect(bounds.x).toBeGreaterThanOrEqual(0);
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
}

test.describe("screen sharing on phones", () => {
  test("an Android phone keeps the camera and a share button that says why not", async ({
    browser,
  }) => {
    const { page, context } = await newParticipant(browser, "Android Teste");
    await asPhone(page, ANDROID, { picker: false });
    await page.setViewportSize({ width: 375, height: 812 });
    await joinRoom(page, await newRoomCode(), { micOn: false });

    const dock = callControls(page);
    await expect(dock.getByRole("button", { name: "Ligar câmera", exact: true })).toBeVisible();
    const share = dock.getByRole("button", {
      name: "Compartilhar tela não é suportado neste navegador",
      exact: true,
    });
    // aria-disabled tells screen readers it is unavailable; a tap still explains why.
    await share.click({ force: true });
    await expect(
      page.getByText(
        "No celular você assiste e conversa. Para compartilhar a tela, entre pelo computador.",
      ),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: /^Tela inteira/ })).toBeHidden();

    await expectDockFits(page, 375);
    await expectDockFits(page, 360);
    await expectDockFits(page, 320);
    await expect(share).toBeHidden();
    await expect(dock.getByRole("button", { name: "Ligar câmera", exact: true })).toBeVisible();
    await context.close();
  });

  test("an iPhone whose Safari offers the picker shares its screen at once, without sound", async ({
    browser,
  }) => {
    const { page, context } = await newParticipant(browser, "iPhone Teste");
    await asPhone(page, IPHONE, { picker: true });
    await fakeScreenCapture(page);
    await page.setViewportSize({ width: 375, height: 812 });
    await joinRoom(page, await newRoomCode(), { micOn: false });

    const dock = callControls(page);
    await expect(dock.getByRole("button", { name: "Ligar câmera", exact: true })).toBeVisible();
    await dock.getByRole("button", { name: "Compartilhar tela", exact: true }).click();
    await expect(page.getByLabel("Prévia da sua tela")).toBeVisible();
    await expect(page.getByRole("button", { name: /^Tela inteira/ })).toBeHidden();

    const stopSharing = dock.getByRole("button", { name: /^Parar de compartilhar/ });
    await expectDockFits(page, 375);
    await expectDockFits(page, 360);
    await stopSharing.click();
    await expect(page.getByLabel("Prévia da sua tela")).toBeHidden();
    await expect(
      dock.getByRole("button", { name: "Compartilhar tela", exact: true }),
    ).toBeEnabled();
    await context.close();
  });
});

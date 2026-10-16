import { expect, type Page } from "@playwright/test";

interface MascotObservation {
  gesture: string | null;
  expression: string | null;
  at: number;
}

type ObservedWindow = Window & { mascotObservations?: MascotObservation[] };

/** Records short gestures in real time, without changing the WebRTC clock. */
export async function observeRoomMascot(page: Page) {
  await page.addInitScript(() => {
    const observed = window as ObservedWindow;
    observed.mascotObservations = [];
    const observer = new MutationObserver(() => {
      const mascot = document.querySelector<HTMLElement>("[data-room-mascot] [data-slot=mascot]");
      const observations = observed.mascotObservations;
      if (!mascot || !observations) return;
      const gesture = mascot.dataset.hostGesture ?? null;
      const expression = mascot.dataset.expression ?? null;
      const previous = observations.at(-1);
      if (previous?.gesture === gesture && previous.expression === expression) return;
      observations.push({ gesture, expression, at: performance.now() });
    });
    observer.observe(document, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["data-host-gesture", "data-expression"],
    });
  });
  return () => page.evaluate(() => (window as ObservedWindow).mascotObservations ?? []);
}

export function roomMascot(page: Page) {
  return page.locator("[data-room-mascot] [data-slot=mascot]");
}

/** Decoded frames prove the remote browser receives media through LiveKit. */
export async function expectScreenFrames(page: Page, presenter: string) {
  await page.getByRole("button", { name: `Assistir à tela de ${presenter}`, exact: true }).click();
  const video = page.getByLabel(`Tela de ${presenter}`, { exact: true });
  await expect(video).toBeVisible();
  await expect
    .poll(() =>
      video.evaluate(
        (element: HTMLVideoElement) => element.getVideoPlaybackQuality().totalVideoFrames,
      ),
    )
    .toBeGreaterThan(5);
  expect(await video.evaluate((element: HTMLVideoElement) => element.videoWidth)).toBeGreaterThan(
    0,
  );
}

export async function expectSettledPresenter(page: Page) {
  const mascot = roomMascot(page);
  await expect(mascot).toHaveAttribute("data-expression", "presenting");
  await expect(mascot).not.toHaveAttribute("data-host-gesture", /.+/);
  await expect
    .poll(() =>
      mascot.locator("[data-mascot-sprite]").evaluate((element) => element.getAnimations().length),
    )
    .toBe(0);
  await expect
    .poll(() =>
      mascot
        .locator("[data-slot=mascot-face]")
        .evaluate((element) => (element as HTMLElement).style.getPropertyValue("--sprite-column")),
    )
    .toBe("0");
}

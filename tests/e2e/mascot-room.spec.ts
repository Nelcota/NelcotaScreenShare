import { expect, test } from "@playwright/test";
import { joinRoom, newParticipant, newRoomCode } from "./support/session";
import {
  expectScreenFrames,
  expectSettledPresenter,
  observeRoomMascot,
  roomMascot,
} from "./support/mascot";

test("welcomes real arrivals, introduces sharing and quietly greets during a three-person call", async ({
  browser,
}, info) => {
  const host = await newParticipant(browser, "Alex Host");
  const viewer = await newParticipant(browser, "Blair Viewer");
  const newcomer = await newParticipant(browser, "Casey Viewer");
  const hostEvents = await observeRoomMascot(host.page);
  const viewerEvents = await observeRoomMascot(viewer.page);
  const newcomerEvents = await observeRoomMascot(newcomer.page);
  try {
    const code = await newRoomCode();
    await joinRoom(host.page, code, { micOn: false });
    await expect(roomMascot(host.page)).toBeHidden();
    await joinRoom(viewer.page, code, { micOn: false });
    await expect
      .poll(async () => (await hostEvents()).filter((event) => event.gesture === "welcome").length)
      .toBe(1);
    await expect(roomMascot(host.page)).toBeVisible();
    await expect(roomMascot(host.page)).not.toHaveAttribute("data-host-gesture", /.+/);
    expect((await viewerEvents()).some((event) => event.gesture === "welcome")).toBe(false);

    const dock = host.page.getByRole("navigation", { name: "Controles da chamada", exact: true });
    // Uses Chromium's native display capture, without replacing getDisplayMedia.
    await dock.getByRole("button", { name: "Compartilhar tela", exact: true }).click();
    await host.page.getByRole("button", { name: /^Tela inteira/ }).click();
    await expect(host.page.getByLabel("Prévia da sua tela")).toBeVisible();
    await expectScreenFrames(viewer.page, host.name);
    await expect
      .poll(async () => (await hostEvents()).some((event) => event.gesture === "presenting"))
      .toBe(true);
    await expectSettledPresenter(host.page);
    await expectSettledPresenter(viewer.page);
    await host.page.screenshot({ path: info.outputPath("sharing-before-arrival.png") });

    const firstWelcome = (await hostEvents()).find((event) => event.gesture === "welcome");
    expect(firstWelcome).toBeDefined();
    await expect
      .poll(() => host.page.evaluate((at) => performance.now() - at, firstWelcome!.at), {
        timeout: 6000,
      })
      .toBeGreaterThan(5100);
    await joinRoom(newcomer.page, code, { micOn: false });
    await expectScreenFrames(newcomer.page, host.name);
    await expect
      .poll(async () => (await hostEvents()).some((event) => event.gesture === "quiet-welcome"))
      .toBe(true);
    const quietWelcomes = (await hostEvents()).filter((event) => event.gesture === "quiet-welcome");
    expect(quietWelcomes.every((event) => event.expression === "presenting")).toBe(true);
    expect(
      (await newcomerEvents()).some(
        (event) => event.gesture === "welcome" || event.gesture === "quiet-welcome",
      ),
    ).toBe(false);
    await expectSettledPresenter(host.page);
    await host.page.screenshot({ path: info.outputPath("three-participant-sharing.png") });

    await dock.getByRole("button", { name: /^Parar de compartilhar/ }).click();
    await expect(roomMascot(host.page)).toHaveAttribute("data-expression", "neutral");
    await expect(viewer.page.locator("[data-mascot-stage]")).toHaveCount(0);
    expect((await hostEvents()).filter((event) => event.gesture === "welcome")).toHaveLength(1);
    await info.attach("mascot-events", {
      body: JSON.stringify(
        {
          host: await hostEvents(),
          viewer: await viewerEvents(),
          newcomer: await newcomerEvents(),
        },
        null,
        2,
      ),
      contentType: "application/json",
    });
  } finally {
    await host.context.close();
    await viewer.context.close();
    await newcomer.context.close();
  }
});

test("the first share reveals the host, and reduced motion suppresses subsequent gestures", async ({
  browser,
}, info) => {
  const host = await newParticipant(browser, "Drew Presenter");
  const viewer = await newParticipant(browser, "Elliot Viewer");
  const events = await observeRoomMascot(host.page);
  try {
    const code = await newRoomCode();
    await joinRoom(host.page, code, { micOn: false });
    await expect(roomMascot(host.page)).toBeHidden();
    await host.page
      .getByRole("navigation", { name: "Controles da chamada", exact: true })
      .getByRole("button", { name: "Compartilhar tela", exact: true })
      .click();
    await host.page.getByRole("button", { name: /^Tela inteira/ }).click();
    await expect(roomMascot(host.page)).toBeVisible();
    await expect
      .poll(async () => (await events()).some((event) => event.gesture === "presenting"))
      .toBe(true);
    await expectSettledPresenter(host.page);

    await host.page.emulateMedia({ reducedMotion: "reduce" });
    const before = (await events()).filter((event) => event.gesture !== null).length;
    await joinRoom(viewer.page, code, { micOn: false });
    await expectScreenFrames(viewer.page, host.name);
    await expectSettledPresenter(host.page);
    expect((await events()).filter((event) => event.gesture !== null)).toHaveLength(before);
    await host.page.screenshot({ path: info.outputPath("reduced-motion-sharing.png") });
  } finally {
    await host.context.close();
    await viewer.context.close();
  }
});

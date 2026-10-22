import { expect, test, type Locator, type Page } from "@playwright/test";
import { fakeScreenCapture } from "./support/screen-capture";
import { expectNoHorizontalScroll, joinRoom, newParticipant, newRoomCode } from "./support/session";

test.use({ actionTimeout: 15_000 });

async function setLevel(slider: Locator, percentage: number) {
  await slider.press("Home");
  for (let step = 0; step < percentage / 5; step += 1) await slider.press("ArrowRight");
  await expect(slider).toHaveAttribute("aria-valuenow", String(percentage));
}

async function shareScreen(page: Page) {
  await page.getByRole("button", { name: "Compartilhar tela", exact: true }).click();
  await page.getByRole("button", { name: /^Tela inteira/ }).click();
  await expect(page.getByRole("button", { name: /^Parar de compartilhar/ })).toBeVisible();
}

test("individual playback survives track replacement, deafening and navigation", async ({
  browser,
}) => {
  test.setTimeout(120_000);
  const sender = await newParticipant(browser, "Audio Remetente");
  const listener = await newParticipant(browser, "Audio Leitor");
  const other = await newParticipant(browser, "Audio Outra Pessoa");
  try {
    let interruptSignal: (() => Promise<void>) | undefined;
    await listener.page.routeWebSocket(/\/rtc(?:\/v1)?\?/, (socket) => {
      socket.connectToServer();
      interruptSignal = () => socket.close({ code: 1012, reason: "Test reconnection" });
    });
    await fakeScreenCapture(sender.page, { withSound: true, safeAudio: true });
    const code = await newRoomCode();
    await joinRoom(sender.page, code);
    await joinRoom(listener.page, code);
    const initialVoice = listener.page.locator('audio[data-source="voice"]');
    await expect(initialVoice).toHaveCount(1);
    const identity = await initialVoice.getAttribute("data-participant");
    if (!identity) throw new Error("Missing sender track identity");
    await joinRoom(other.page, code);
    await shareScreen(sender.page);
    // A shared screen, and its sound, wait for "Assistir" (watch to view).
    for (const viewer of [listener, other]) {
      await viewer.page.getByRole("button", { name: "Assistir à tela de Audio Remetente" }).click();
    }
    await expect(
      listener.page.getByRole("region", { name: "Tela compartilhada por Audio Remetente" }),
    ).toBeVisible();

    const voice = listener.page.locator(
      `audio[data-participant="${identity}"][data-source="voice"]`,
    );
    const sound = listener.page.locator(
      `audio[data-participant="${identity}"][data-source="sharedAudio"]`,
    );
    await expect(voice).toHaveCount(1);
    await expect(sound).toHaveCount(1);
    await expect(listener.page.getByRole("button", { name: "Áudio de Audio Leitor" })).toHaveCount(
      0,
    );
    await listener.page.getByRole("button", { name: "Áudio de Audio Remetente" }).click();
    const menu = listener.page.getByRole("dialog", { name: "Áudio de Audio Remetente" });
    await setLevel(menu.getByRole("slider", { name: "Voz de Audio Remetente", exact: true }), 40);
    await expect(voice).toHaveJSProperty("volume", 0.4);
    await expect(sound).toHaveJSProperty("volume", 1);
    await setLevel(menu.getByRole("slider", { name: "Som compartilhado de Audio Remetente" }), 25);
    await expect(sound).toHaveJSProperty("volume", 0.25);
    await menu.getByRole("button", { name: "Silenciar só para mim" }).click();
    await expect(voice).toHaveJSProperty("volume", 0);
    await expect(sound).toHaveJSProperty("volume", 0);
    await expect(other.page.locator(`audio[data-participant="${identity}"]`)).toHaveCount(2);
    for (const track of await other.page.locator(`audio[data-participant="${identity}"]`).all()) {
      await expect(track).toHaveJSProperty("volume", 1);
    }
    await menu.getByRole("button", { name: "Voltar a ouvir", exact: true }).click();
    await expect(voice).toHaveJSProperty("volume", 0.4);
    await expect(sound).toHaveJSProperty("volume", 0.25);

    if (!interruptSignal) throw new Error("Missing LiveKit signaling connection");
    await interruptSignal();
    await expect(listener.page.getByText("Conexão restabelecida.", { exact: true })).toBeVisible();
    await expect(voice).toHaveJSProperty("volume", 0.4);
    await expect(sound).toHaveJSProperty("volume", 0.25);
    await listener.page.keyboard.press("Escape");

    await listener.page.getByRole("button", { name: "Parar de ouvir a sala" }).click();
    await expect(voice).toHaveJSProperty("volume", 0);
    await expect(sound).toHaveJSProperty("volume", 0);
    await listener.page.getByRole("button", { name: "Voltar a ouvir a sala" }).click();
    await expect(voice).toHaveJSProperty("volume", 0.4);
    await expect(sound).toHaveJSProperty("volume", 0.25);

    await sender.page.getByRole("button", { name: /^Parar de compartilhar/ }).click();
    await expect(sound).toHaveCount(0);
    await shareScreen(sender.page);
    await listener.page.getByRole("button", { name: "Assistir à tela de Audio Remetente" }).click();
    await expect(sound).toHaveCount(1);
    await expect(sound).toHaveJSProperty("volume", 0.25);

    await listener.page.getByRole("button", { name: "Mais opções", exact: true }).click();
    await listener.page.getByRole("dialog").getByRole("link", { name: "Configurações" }).click();
    await expect(
      listener.page.getByRole("complementary", { name: "Chamada em andamento" }),
    ).toBeVisible();
    await expect(voice).toHaveJSProperty("volume", 0.4);
    await expect(sound).toHaveJSProperty("volume", 0.25);
    await listener.page.getByRole("link", { name: "Voltar à chamada", exact: true }).click();

    // The top-bar entry stays reachable when the participant strip is hidden on a short viewport.
    await listener.page.setViewportSize({ width: 640, height: 320 });
    await listener.page.getByRole("button", { name: /3 pessoas/ }).click();
    await listener.page.getByRole("button", { name: "Áudio de Audio Remetente" }).click();
    await expect(
      menu.getByRole("slider", { name: "Voz de Audio Remetente", exact: true }),
    ).toHaveAttribute("aria-valuenow", "40");
    await menu.getByRole("button", { name: "Restaurar volumes" }).click();
    await expect(voice).toHaveJSProperty("volume", 1);
    await expect(sound).toHaveJSProperty("volume", 1);
    await expectNoHorizontalScroll(listener.page);
    await expect
      .poll(() =>
        menu.evaluate((panel) => {
          const bounds = panel.getBoundingClientRect();
          return bounds.top >= 15 && bounds.bottom <= window.innerHeight - 15;
        }),
      )
      .toBe(true);
    await menu.evaluate((panel) => {
      panel.scrollTop = 0;
    });
    await expect(menu.getByText("Áudio de Audio Remetente", { exact: true })).toBeVisible();
    await listener.page.screenshot({ path: test.info().outputPath("individual-audio-mobile.png") });
  } finally {
    await sender.context.close();
    await listener.context.close();
    await other.context.close();
  }
});

test("shared sound is disabled until the participant publishes it", async ({ browser }) => {
  const sender = await newParticipant(browser, "Audio Sem Tela");
  const listener = await newParticipant(browser, "Audio Apenas Voz");
  try {
    const code = await newRoomCode();
    await joinRoom(sender.page, code);
    await joinRoom(listener.page, code);
    await listener.page.getByRole("button", { name: "Áudio de Audio Sem Tela" }).click();
    await expect(
      listener.page.getByRole("slider", { name: "Som compartilhado de Audio Sem Tela" }),
    ).toBeDisabled();
    await expect(
      listener.page.getByRole("slider", { name: "Voz de Audio Sem Tela", exact: true }),
    ).toBeEnabled();
    await listener.page.screenshot({
      path: test.info().outputPath("individual-audio-desktop.png"),
    });
  } finally {
    await sender.context.close();
    await listener.context.close();
  }
});

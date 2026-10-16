import { expect, test } from "@playwright/test";
import { newParticipant, newRoomCode } from "./support/session";

test("audio and video settings test the devices and keep the choices", async ({ browser }) => {
  const { page, context } = await newParticipant(browser, "Ajustes Midia");
  await context.grantPermissions(["microphone", "camera"]);
  await page.goto("/conta");
  const section = page.getByRole("region", { name: "Áudio e vídeo" });
  await expect(section).toBeVisible();

  await section.getByRole("button", { name: "Testar microfone" }).click();
  await expect(
    section.getByText(/Fale para testar|Captando áudio|Microfone testado/),
  ).toBeVisible();
  await section.getByRole("button", { name: "Parar teste" }).click();

  await section.getByRole("combobox", { name: "Saída de som" }).click();
  await page.getByRole("option", { name: "Fake Audio Output 1" }).click();
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem("nelcota:saida-som")))
    .not.toBeNull();
  await section.getByRole("button", { name: "Testar som" }).click();
  await expect(section.getByRole("button", { name: "Testar som" })).toBeEnabled();

  await section.getByRole("button", { name: "Ver câmera" }).click();
  const preview = section.getByLabel("Prévia da câmera");
  await expect(preview).toHaveClass(/-scale-x-100/);
  await expect
    .poll(() => preview.evaluate((video: HTMLVideoElement) => video.readyState))
    .toBeGreaterThan(0);
  await section.getByRole("button", { name: "Fechar prévia" }).click();
  await expect(preview).toHaveCount(0);

  const noise = section.getByRole("switch", { name: "Redução de ruído" });
  await expect(noise).toBeChecked();
  await noise.click();
  await page.reload();
  await expect(
    page
      .getByRole("region", { name: "Áudio e vídeo" })
      .getByRole("switch", { name: "Redução de ruído" }),
  ).not.toBeChecked();
  await context.close();
});

test("the microphone test uses the saved clean-up and follows a changed switch", async ({
  browser,
}) => {
  const { page, context } = await newParticipant(browser, "Teste Limpeza");
  await context.grantPermissions(["microphone"]);
  // Records the audio constraints of every capture the page asks for.
  await context.addInitScript(() => {
    const calls: unknown[] = [];
    Object.assign(window, { recordedAudioConstraints: calls });
    const original = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = (constraints) => {
      calls.push(constraints?.audio ?? null);
      return original(constraints);
    };
  });
  await page.goto("/conta");
  const section = page.getByRole("region", { name: "Áudio e vídeo" });
  await section.getByRole("switch", { name: "Redução de ruído" }).click();
  await section.getByRole("button", { name: "Testar microfone" }).click();
  const lastAudio = () =>
    page.evaluate(() => {
      const calls = (window as unknown as { recordedAudioConstraints: Record<string, unknown>[] })
        .recordedAudioConstraints;
      return calls.at(-1) ?? null;
    });
  await expect.poll(lastAudio).toMatchObject({ noiseSuppression: false, echoCancellation: true });

  await section.getByRole("switch", { name: "Cancelamento de eco" }).click();
  await expect.poll(lastAudio).toMatchObject({ noiseSuppression: false, echoCancellation: false });
  await context.close();
});

test("the pre-join remembers joining with the microphone off", async ({ browser }) => {
  const { page, context } = await newParticipant(browser, "Lembra Mic");
  try {
    await page.goto(`/sala/${await newRoomCode()}`);
    const microphone = page.getByRole("switch").first();
    await expect(microphone).toBeChecked();
    await microphone.click();
    await expect(microphone).not.toBeChecked();
    await page.reload();
    await expect(page.getByRole("button", { name: "Entrar só ouvindo" })).toBeVisible();
    await expect(page.getByRole("switch").first()).not.toBeChecked();
  } finally {
    await context.close();
  }
});

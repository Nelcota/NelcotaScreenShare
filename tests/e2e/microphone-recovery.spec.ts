import { expect, test } from "@playwright/test";
import { joinRoom, newParticipant, newRoomCode } from "./support/session";

test("an unplugged microphone moves the call to the system default", async ({ browser }) => {
  const participant = await newParticipant(browser, "Mic Solto");
  await participant.page.addInitScript(() => {
    const capture = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    const captured: MediaStreamTrack[] = [];
    navigator.mediaDevices.getUserMedia = async (constraints) => {
      const stream = await capture(constraints);
      captured.push(...stream.getAudioTracks());
      return stream;
    };
    Object.assign(window, {
      unplugMicrophone: () => {
        const track = captured.findLast((candidate) => candidate.readyState === "live");
        track?.stop();
        track?.dispatchEvent(new Event("ended"));
      },
      liveMicrophones: () => captured.filter((track) => track.readyState === "live").length,
    });
  });
  await joinRoom(participant.page, await newRoomCode());
  await expect(participant.page.getByRole("button", { name: /Desligar microfone/ })).toBeVisible();

  await participant.page.evaluate(() =>
    (window as unknown as { unplugMicrophone: () => void }).unplugMicrophone(),
  );
  await expect(
    participant.page.getByText(/Microfone desconectado. Agora o som vem de/),
  ).toBeVisible();
  await expect(participant.page.getByRole("button", { name: /Desligar microfone/ })).toBeVisible();
  await expect
    .poll(() =>
      participant.page.evaluate(() =>
        (window as unknown as { liveMicrophones: () => number }).liveMicrophones(),
      ),
    )
    .toBe(1);

  await participant.context.close();
});

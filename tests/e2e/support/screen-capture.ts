import type { Page } from "@playwright/test";
/**
 * Fake shared screen: an animated canvas instead of the browser's picker. `withSound`
 * adds computer audio that, like a real capture without `restrictOwnAudio`, would carry
 * the room's playback.
 */
export async function fakeScreenCapture(page: Page, { withSound = false } = {}) {
  await page.addInitScript((sound) => {
    navigator.mediaDevices.getDisplayMedia = () => {
      const canvas = document.createElement("canvas");
      canvas.width = 1280;
      canvas.height = 720;
      const context = canvas.getContext("2d");
      let frame = 0;
      setInterval(() => {
        frame += 1;
        if (!context) return;
        context.fillStyle = frame % 2 ? "#3a7" : "#173";
        context.fillRect(0, 0, canvas.width, canvas.height);
      }, 100);
      const stream = canvas.captureStream(15);
      if (sound) {
        const audio = new AudioContext();
        const destination = audio.createMediaStreamDestination();
        audio.createOscillator().connect(destination);
        stream.addTrack(destination.stream.getAudioTracks()[0]!);
      }
      return Promise.resolve(stream);
    };
  }, withSound);
}

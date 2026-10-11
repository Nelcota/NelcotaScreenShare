import {
  currentChatSound,
  type ChatNotificationSound,
} from "@/features/room/domain/chat-notification-sound";
import { logBrowserWarning } from "@/lib/telemetry.client";

let audio: AudioContext | undefined;

/** Original synthesized notes: no recordings or third-party notification samples. */
function scheduleNote(context: AudioContext, frequency: number, start: number, duration: number) {
  const oscillator = context.createOscillator();
  const volume = context.createGain();
  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(frequency, start);
  volume.gain.setValueAtTime(0, start);
  volume.gain.linearRampToValueAtTime(0.055, start + 0.015);
  volume.gain.exponentialRampToValueAtTime(0.001, start + duration);
  oscillator.connect(volume);
  volume.connect(context.destination);
  oscillator.addEventListener(
    "ended",
    () => {
      oscillator.disconnect();
      volume.disconnect();
    },
    { once: true },
  );
  oscillator.start(start);
  oscillator.stop(start + duration);
}

export async function playChatNotification(
  sound: ChatNotificationSound = currentChatSound(),
  userGesture = false,
): Promise<boolean> {
  if (sound === "off" || typeof AudioContext === "undefined") return false;
  try {
    if (userGesture) {
      if (!audio || audio.state === "closed") audio = new AudioContext();
      if (audio.state === "suspended") await audio.resume();
    }
    if (!audio) return false;
    if (audio.state !== "running") return false;
    const start = audio.currentTime;
    if (sound === "soft") {
      scheduleNote(audio, 740, start, 0.22);
      return true;
    }
    scheduleNote(audio, 620, start, 0.2);
    scheduleNote(audio, 930, start + 0.09, 0.26);
    return true;
  } catch (error) {
    logBrowserWarning("Could not play the chat notification sound", error);
    return false;
  }
}

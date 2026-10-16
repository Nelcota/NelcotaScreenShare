import { createStoredValue } from "@/lib/stored-value";

export type ChatNotificationSound = "soft" | "chime" | "off";

export function isChatNotificationSound(value: unknown): value is ChatNotificationSound {
  return value === "soft" || value === "chime" || value === "off";
}

const chatSound = createStoredValue<ChatNotificationSound>({
  key: "nelcota-chat-notification-sound",
  changeEvent: "nelcota-chat-sound-change",
  fallback: "soft",
  parse: (raw) => (isChatNotificationSound(raw) ? raw : undefined),
  serialize: (sound) => sound,
  warning: "Could not save or read the chat sound preference",
});

export const currentChatSound = chatSound.read;
export const setChatSound = chatSound.write;
export const subscribeChatSound = chatSound.subscribe;

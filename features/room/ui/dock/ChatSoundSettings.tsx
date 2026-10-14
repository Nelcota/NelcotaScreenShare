import { useId, useSyncExternalStore } from "react";
import { Play } from "lucide-react";
import { ChoiceSelect } from "@/components/ChoiceSelect";
import { Button } from "@/components/ui/button";
import { playChatNotification, unlockChatAudio } from "@/features/room/audio/chat-notification";
import {
  currentChatSound,
  isChatNotificationSound,
  setChatSound,
  subscribeChatSound,
} from "@/features/room/domain/chat-notification-sound";

const SOUND_OPTIONS = [
  { value: "soft", label: "Suave" },
  { value: "chime", label: "Duas notas" },
  { value: "off", label: "Sem som" },
] as const;

export function ChatSoundSettings() {
  const id = useId();
  const sound = useSyncExternalStore(subscribeChatSound, currentChatSound, () => "soft" as const);
  return (
    <div className="flex shrink-0 items-center gap-2 border-b border-line px-4 py-2">
      <label htmlFor={id} className="text-xs text-ink-muted">
        Som do aviso
      </label>
      <ChoiceSelect
        id={id}
        value={sound}
        options={SOUND_OPTIONS}
        onValueChange={(value) => {
          if (!isChatNotificationSound(value)) return;
          setChatSound(value);
          // Selecting a sound is a user gesture, even after the initial muted gestures.
          void unlockChatAudio(value);
        }}
        className="h-8 min-w-0 flex-1 bg-surface"
      />
      <Button
        variant="ghost"
        size="icon"
        disabled={sound === "off"}
        aria-label="Ouvir som da notificação"
        onClick={() => void playChatNotification(sound, true)}
      >
        <Play className="size-4" aria-hidden="true" />
      </Button>
    </div>
  );
}

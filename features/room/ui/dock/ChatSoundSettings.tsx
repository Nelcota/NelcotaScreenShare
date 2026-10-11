import { useId, useSyncExternalStore } from "react";
import { Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { playChatNotification } from "@/features/room/audio/chat-notification";
import {
  currentChatSound,
  isChatNotificationSound,
  setChatSound,
  subscribeChatSound,
} from "@/features/room/domain/chat-notification-sound";

export function ChatSoundSettings() {
  const id = useId();
  const sound = useSyncExternalStore(subscribeChatSound, currentChatSound, () => "soft" as const);
  return (
    <div className="flex shrink-0 items-center gap-2 border-b border-line px-4 py-2">
      <label htmlFor={id} className="text-xs text-ink-muted">
        Som do aviso
      </label>
      <select
        id={id}
        value={sound}
        onChange={(event) => {
          const value = event.target.value;
          if (isChatNotificationSound(value)) setChatSound(value);
        }}
        className="min-w-0 flex-1 rounded-lg border border-line bg-surface px-2 py-1.5 text-sm"
      >
        <option value="soft">Suave</option>
        <option value="chime">Duas notas</option>
        <option value="off">Sem som</option>
      </select>
      <Button
        variant="ghost"
        size="icon"
        disabled={sound === "off"}
        aria-label="Ouvir som da notificação"
        onClick={() => void playChatNotification(sound, true)}
      >
        <Volume2 className="size-4" aria-hidden="true" />
      </Button>
    </div>
  );
}

import type { TrackReference } from "@livekit/components-react";
import { Eye, MonitorUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { participantLabel } from "@/features/room/domain/participant-label";
import { useScreenWatch } from "@/features/room/hooks/use-screen-watch";

/** Screens nobody here is watching yet: each one waits for "Assistir". */
export function ShareInvites({ invites }: { invites: TrackReference[] }) {
  const { watch, takeFocus } = useScreenWatch();
  if (invites.length === 0) return null;

  return (
    <ul aria-label="Telas compartilhadas" className="flex w-full max-w-md flex-col gap-2">
      {invites.map((invite) => {
        const name = participantLabel(invite.participant);
        return (
          <li
            key={invite.publication.trackSid}
            className="glass flex items-center gap-3 rounded-2xl p-3"
          >
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-surface-2 text-brand-soft">
              <MonitorUp className="size-5" aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1 truncate text-sm font-medium">
              {name} está compartilhando a tela
            </span>
            <Button
              ref={(button) => {
                if (button && takeFocus(invite.publication.trackSid, "invite")) button.focus();
              }}
              aria-label={`Assistir à tela de ${name}`}
              onClick={() => watch(invite.publication.trackSid)}
            >
              <Eye aria-hidden="true" />
              Assistir
            </Button>
          </li>
        );
      })}
    </ul>
  );
}

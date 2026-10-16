import { VideoTrack, type TrackReference } from "@livekit/components-react";
import { X } from "lucide-react";
import { Hint } from "@/components/Hint";
import { participantLabel } from "@/features/room/domain/participant-label";
import { cn } from "@/lib/utils";

/** A camera enlarged on the stage, until the person closes it or the camera goes off. */
export function CameraStage({ camera, onClose }: { camera: TrackReference; onClose: () => void }) {
  const name = participantLabel(camera.participant);
  return (
    <section
      aria-label={`Câmera de ${name}`}
      className="relative min-h-0 flex-1 overflow-hidden rounded-2xl border border-line bg-black shadow-soft"
    >
      <VideoTrack
        trackRef={camera}
        className={cn("size-full object-contain", camera.participant.isLocal && "-scale-x-100")}
      />
      <div className="pointer-events-none absolute inset-x-3 top-3 flex items-start justify-between gap-3">
        <span className="glass inline-flex min-w-0 items-center rounded-xl px-3 py-1.5 text-sm font-medium">
          <span className="truncate">{name}</span>
        </span>
        <Hint text="Fechar">
          <button
            type="button"
            aria-label="Fechar a câmera ampliada"
            onClick={onClose}
            className="glass pointer-events-auto grid size-9 place-items-center rounded-xl text-ink-muted transition-colors hover:text-ink"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </Hint>
      </div>
    </section>
  );
}

import { VideoTrack, type TrackReference } from "@livekit/components-react";
import { cn } from "@/lib/utils";

/** Your own camera shows mirrored, as in a mirror; everyone else sees it the right way round. */
export function CameraVideo({ camera, className }: { camera: TrackReference; className: string }) {
  return (
    <VideoTrack
      trackRef={camera}
      aria-hidden="true"
      className={cn(className, "object-cover", camera.participant.isLocal && "-scale-x-100")}
    />
  );
}

/** Over a camera: clicking the person's card enlarges it on the stage. */
export function EnlargeButton({
  name,
  rounded,
  onEnlarge,
}: {
  name: string;
  rounded: string;
  onEnlarge: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={`Ampliar a câmera de ${name}`}
      onClick={onEnlarge}
      className={cn(
        "absolute inset-0 z-20 cursor-zoom-in focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
        rounded,
      )}
    />
  );
}

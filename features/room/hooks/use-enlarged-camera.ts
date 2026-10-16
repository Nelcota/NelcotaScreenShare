import { useTracks } from "@livekit/components-react";
import { Track } from "livekit-client";
import { useState } from "react";

/**
 * The camera enlarged on the stage, by person. When that camera goes off the stage goes
 * back, and turning it on again does not enlarge it by itself.
 */
export function useEnlargedCamera() {
  const cameras = useTracks([Track.Source.Camera]);
  const [enlarged, setEnlarged] = useState<string>();
  const camera = cameras.find(
    (candidate) =>
      candidate.participant.identity === enlarged &&
      candidate.publication.track !== undefined &&
      !candidate.publication.isMuted,
  );
  if (enlarged !== undefined && camera === undefined) setEnlarged(undefined);
  return { camera, enlarge: setEnlarged, close: () => setEnlarged(undefined) };
}

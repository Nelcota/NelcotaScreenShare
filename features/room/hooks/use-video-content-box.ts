import { useEffect, useState, type RefObject } from "react";
import { contentBox } from "@/features/room/domain/content-box";

/** Image area inside the <video> (`object-contain` leaves black bars). */
export function useVideoContentBox(videoRef: RefObject<HTMLVideoElement | null>) {
  const [box, setBox] = useState<ReturnType<typeof contentBox>>();

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const update = () =>
      setBox(
        contentBox(
          { width: video.clientWidth, height: video.clientHeight },
          { width: video.videoWidth, height: video.videoHeight },
        ),
      );
    update();
    const observer = new ResizeObserver(update);
    observer.observe(video);
    // "resize" fires when the video resolution changes (e.g. switching windows).
    video.addEventListener("resize", update);
    video.addEventListener("loadedmetadata", update);
    return () => {
      observer.disconnect();
      video.removeEventListener("resize", update);
      video.removeEventListener("loadedmetadata", update);
    };
  }, [videoRef]);

  return box;
}

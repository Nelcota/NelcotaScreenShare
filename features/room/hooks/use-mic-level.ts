import { useEffect, useEffectEvent, useRef, type RefObject } from "react";
import { startMicLevel, type MicLevelEvents } from "./mic-level-capture";
import { useSavedAudioProcessing } from "./use-saved-audio-processing";

/**
 * Live microphone meter: local capture + voice level, written straight to the
 * bar element (no re-render per frame). The level also goes to the
 * "listening" mascot through the returned ref.
 */
export function useMicLevel(
  meterRef: RefObject<HTMLDivElement | null>,
  active: boolean,
  deviceId: string | undefined,
  events: MicLevelEvents,
): RefObject<number> {
  const levelRef = useRef(0);
  // A changed switch restarts the capture with the new clean-up.
  const processing = useSavedAudioProcessing();
  const onDevices = useEffectEvent(events.onDevices);
  const onDevice = useEffectEvent(events.onDevice);
  const onMissingDevice = useEffectEvent(events.onMissingDevice);
  const onPermissionDenied = useEffectEvent(events.onPermissionDenied);
  const onError = useEffectEvent(events.onError);
  const onCheck = useEffectEvent(events.onCheck);

  useEffect(() => {
    const meter = meterRef.current;
    if (!active || !meter) return;
    const meterStyle = meter.style;
    const mediaDevices = navigator.mediaDevices;
    if (!mediaDevices) {
      onError(new Error("MediaDevices is unavailable."));
      return;
    }
    return startMicLevel({
      meterStyle,
      mediaDevices,
      deviceId,
      processing,
      levelRef,
      events: {
        onDevices: (devices) => onDevices(devices),
        onDevice: (capturedId, requestedId) => onDevice(capturedId, requestedId),
        onMissingDevice: () => onMissingDevice(),
        onPermissionDenied: () => onPermissionDenied(),
        onError: (error) => onError(error),
        onCheck: (state, source) => onCheck(state, source),
      },
    });
  }, [active, deviceId, meterRef, processing]);

  return levelRef;
}

import { Track, type Room } from "livekit-client";
import { encodeMessage, TOPICS } from "@/features/room/domain/data-channel";
import { logBrowserWarning } from "@/lib/telemetry.client";

/** Who shares this screen, among the people in the room, if they are still here. */
function sharerOf(room: Room, trackSid: string): string | undefined {
  for (const participant of room.remoteParticipants.values()) {
    const screen = participant.getTrackPublication(Track.Source.ScreenShare);
    if (screen?.trackSid === trackSid) return participant.identity;
  }
  return undefined;
}

/**
 * Tells only the sharer that this person started or stopped watching their screen, so they
 * hear it. Best effort: a lost notice costs a sound, nothing else.
 */
export async function noticeWatching(room: Room, trackSid: string, watching: boolean) {
  const sharer = sharerOf(room, trackSid);
  if (!sharer) return;
  try {
    // A fresh copy: publishData takes an array backed by a plain ArrayBuffer.
    await room.localParticipant.publishData(new Uint8Array(encodeMessage({ trackSid, watching })), {
      reliable: true,
      topic: TOPICS.screenWatch,
      destinationIdentities: [sharer],
    });
  } catch (error) {
    logBrowserWarning("Could not tell the sharer about watching", error);
  }
}

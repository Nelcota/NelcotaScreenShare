import { isGuestIdentity } from "@/features/room/domain/participant-label";

const PARTICIPANT_PHOTO_PATH = "/api/sala/foto";

/**
 * Where the browser loads someone's profile photo during a call. Guests have no account,
 * so no photo: the avatar keeps their initials.
 */
export function participantPhotoPath(roomCode: string, identity: string): string | null {
  if (isGuestIdentity(identity)) return null;
  const query = new URLSearchParams({ sala: roomCode, pessoa: identity });
  return `${PARTICIPANT_PHOTO_PATH}?${query.toString()}`;
}

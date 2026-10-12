import { parseShareProfile, type ShareProfile } from "@/features/room/domain/share-profile";

const PROFILE_KEY = "nelcota:share-profile:v1";

export function savedShareProfile(): ShareProfile {
  try {
    return parseShareProfile(localStorage.getItem(PROFILE_KEY));
  } catch {
    return "automatic";
  }
}

export function saveShareProfile(profile: ShareProfile) {
  try {
    localStorage.setItem(PROFILE_KEY, profile);
  } catch {
    // Blocked storage only disables remembering this browser's preference.
  }
}

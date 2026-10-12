export type ShareProfile = "automatic" | "text" | "video" | "data-saver";

interface ShareProfileOptions {
  preset: "h1080fps15" | "h1080fps30" | "h720fps15";
  contentHint: "detail" | "text" | "motion";
}

const PROFILES: Record<Exclude<ShareProfile, "automatic">, ShareProfileOptions> = {
  text: { preset: "h1080fps15", contentHint: "text" },
  video: { preset: "h1080fps30", contentHint: "motion" },
  "data-saver": { preset: "h720fps15", contentHint: "detail" },
};

export function parseShareProfile(value: unknown): ShareProfile {
  if (value === "text" || value === "video" || value === "data-saver") return value;
  return "automatic";
}

/** Automatic preserves the original surface-based defaults. Browsers may lower these targets. */
export function resolveShareProfile(
  profile: ShareProfile,
  surface: string,
): Readonly<ShareProfileOptions> {
  if (profile !== "automatic") return PROFILES[profile];
  if (surface === "browser") return PROFILES.video;
  return { preset: "h1080fps15", contentHint: "detail" };
}

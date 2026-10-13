/** `?atendeu=1`: from an accepted ring or from Chamar, the room joins without the pre-join. */
export const ANSWERED_CALL_PARAM = "atendeu";

/** The room's address for someone who just accepted a ring or started a call. */
export function answeredCallPath(path: string): string {
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}${ANSWERED_CALL_PARAM}=1`;
}

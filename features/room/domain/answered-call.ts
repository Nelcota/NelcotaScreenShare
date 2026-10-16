/** `?atendeu=1`: the person accepted a ring, so the room joins without the pre-join. */
export const ANSWERED_CALL_PARAM = "atendeu";

/** The room's address for someone who just accepted a ring. */
export function answeredCallPath(path: string): string {
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}${ANSWERED_CALL_PARAM}=1`;
}

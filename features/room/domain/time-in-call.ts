const MINUTE = 60_000;

/** "há 12 min", "há 1 h 5 min": how long someone has been in the call. */
export function timeInCallLabel(joinedAt: Date, now: Date): string {
  const minutes = Math.max(0, Math.floor((now.getTime() - joinedAt.getTime()) / MINUTE));
  if (minutes < 1) return "há menos de 1 min";
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (rest === 0) return `há ${hours} h`;
  return `há ${hours} h ${rest} min`;
}

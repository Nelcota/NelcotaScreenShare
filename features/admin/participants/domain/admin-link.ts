/** How many app accounts may show the panel link; the owner picks each one. */
export const MAX_ADMIN_LINKS = 50;

/** The list with `userId` turned on or off, without repeats; always a new array. */
export function withAdminLink(userIds: readonly string[], userId: string, on: boolean): string[] {
  const others = userIds.filter((id) => id !== userId);
  if (!on) return others;
  return [...others, userId];
}

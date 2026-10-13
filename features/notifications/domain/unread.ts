const UNREAD_PREFIX = /^\(\d+\+?\)\s+/;

/** The count as it fits on the tab icon: up to 9, then "9+". */
export function badgeLabel(count: number): string {
  if (count > 9) return "9+";
  return String(count);
}

/** "(3) Nelcota": the page title with the unread count in front, or as it was at zero. */
export function titleWithUnread(title: string, count: number): string {
  const plain = title.replace(UNREAD_PREFIX, "");
  if (count <= 0) return plain;
  return `(${badgeLabel(count)}) ${plain}`;
}

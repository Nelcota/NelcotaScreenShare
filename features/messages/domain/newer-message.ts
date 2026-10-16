/**
 * Whether a message came after the newest one already seen. Ids are UUIDv7, so they sort by
 * time: reading a newer conversation can make an older unread the latest again, and that one
 * was already notified.
 */
export function isNewerMessage(id: string, newestSeen: string | undefined): boolean {
  if (!newestSeen) return true;
  return id > newestSeen;
}

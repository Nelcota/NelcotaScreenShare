/** A friend link token: 32 bytes in base64url. */
const FRIEND_LINK_TOKEN = /^[A-Za-z0-9_-]{43}$/;

export function isFriendLinkToken(value: string): boolean {
  return FRIEND_LINK_TOKEN.test(value);
}

export function friendLinkPath(token: string): string {
  return `/amigo/${token}`;
}

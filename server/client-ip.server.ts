/**
 * Header with the client's real IP, computed in the middleware from
 * X-Forwarded-For and TRUSTED_PROXY_HOPS. It is always overwritten in the middleware, so
 * whatever the client sends in this header never reaches the app.
 */
export const CLIENT_IP_HEADER = "x-client-ip";

/** Socket address of whoever talked to the app, set by app/server.ts on every request. */
const PEER_IP_HEADER = "x-nelcota-peer-ip";

export function clientIpFrom(headers: Headers): string | undefined {
  const ip = headers.get(CLIENT_IP_HEADER);
  return ip && ip !== "unknown" ? ip : undefined;
}

/** "::ffff:10.0.0.1" is the IPv4 address 10.0.0.1 on a dual-stack socket. */
function plainAddress(address: string): string {
  return address
    .trim()
    .toLowerCase()
    .replace(/^::ffff:(?=\d)/, "");
}

const PRIVATE_IPV4 = [
  /^10\./,
  /^127\./,
  /^169\.254\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./,
];

/**
 * Loopback, private and link-local addresses: where the proxies in front of the app (Coolify's
 * Traefik, on the Docker network) talk from. A public socket address means the request did
 * not come through them.
 */
function isInternalAddress(ip: string): boolean {
  if (PRIVATE_IPV4.some((range) => range.test(ip))) return true;
  return ip === "::1" || /^f[cd][0-9a-f]{2}:/.test(ip) || /^fe[89ab][0-9a-f]:/.test(ip);
}

/**
 * Client IP behind trusted proxies. Each proxy appends to the end of
 * X-Forwarded-For the IP of whoever talked to it; the values on the left come from the
 * client and can be forged. With `trustedHops` proxies in front of the app
 * (Traefik = 1; Cloudflare + Traefik = 2), the real IP is the `trustedHops`-th
 * from the end. The forwarding headers only count when the socket is one of those proxies:
 * a request straight to the app's port is the IP of its socket, whatever it claims.
 */
export function getClientIp(headers: Headers, trustedHops = 1): string {
  const socket = headers.get(PEER_IP_HEADER);
  const peer = socket ? plainAddress(socket) || undefined : undefined;
  if (peer && !isInternalAddress(peer)) return peer;
  const hops =
    headers
      .get("x-forwarded-for")
      ?.split(",")
      .map((ip) => ip.trim())
      .filter(Boolean) ?? [];
  const ip = hops.at(Math.max(0, hops.length - trustedHops));
  if (ip) return ip;
  return headers.get("x-real-ip")?.trim() || peer || "unknown";
}

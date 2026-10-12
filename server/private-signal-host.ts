import { isIP } from "node:net";

/** Recognized private signaling addresses. Deployment must also fence public proxy routes. */
export function isPrivateSignalHost(hostname: string): boolean {
  if (hostname === "localhost" || hostname === "[::1]" || hostname === "host.docker.internal")
    return true;
  if (isIP(hostname) === 4)
    return (
      ["127.", "10.", "192.168."].some((prefix) => hostname.startsWith(prefix)) ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(hostname)
    );
  return /^[a-z0-9-]+$/i.test(hostname) || hostname.endsWith(".internal");
}

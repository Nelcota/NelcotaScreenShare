import { createRateLimiter } from "@/server/rate-limit.server";
import type { JoinRequester } from "./join-requests.server";

const TEN_MINUTES_MS = 10 * 60_000;

/**
 * Whether someone asking at the door may open a new request to enter. Per IP (a guest
 * without a cookie gets a new id each time) and per person (an account or a cookie can
 * change IP): together they keep one person from filling the host's queue. Ringing a friend
 * opens requests on its own path, so being rung often never runs into this.
 */
export function createJoinRequestGate({ perIp = 10, perPerson = 5 } = {}) {
  const byIp = createRateLimiter({ limit: perIp, windowMs: TEN_MINUTES_MS });
  const byPerson = createRateLimiter({ limit: perPerson, windowMs: TEN_MINUTES_MS });
  return (ipKey: string, requester: JoinRequester): boolean => {
    const person =
      "userId" in requester ? `conta:${requester.userId}` : `convidado:${requester.guestId}`;
    if (!byPerson.hit(person).ok) return false;
    return byIp.hit(ipKey).ok;
  };
}

import type { TokenRefusal } from "./issue-token";

/** HTTP status of each refusal (the body carries the code and the message). */
export const TOKEN_ERROR_STATUS: Record<TokenRefusal, number> = {
  unauthenticated: 401,
  blocked: 403,
  email_unverified: 403,
  rate_limited: 429,
  invalid_request: 400,
  invalid_password: 401,
  room_full: 409,
  invite_invalid: 403,
  host_absent: 409,
  room_not_found: 404,
  banned: 403,
  awaiting_approval: 202,
  room_locked: 403,
  room_removed: 403,
  room_closed: 409,
  server_error: 502,
};

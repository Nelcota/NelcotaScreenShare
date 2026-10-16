import assert from "node:assert/strict";
import { test } from "vitest";
import { generateRoomCode, roomCodeSchema, roomPath } from "@/features/room/domain/room-code";
import { getClientIp } from "@/server/client-ip.server";
import { buildCsp } from "@/server/csp.server";
import { createRateLimiter } from "@/server/rate-limit.server";

test("rate limit: counts, blocks and releases when the window rolls over", () => {
  let now = 1_000;
  const limiter = createRateLimiter({ limit: 2, windowMs: 10_000, now: () => now });

  assert.equal(limiter.peek("a").ok, true);
  assert.equal(limiter.hit("a").ok, true);
  assert.equal(limiter.hit("a").ok, true);
  assert.equal(limiter.peek("a").ok, false);
  const blocked = limiter.hit("a");
  assert.equal(blocked.ok, false);
  assert.equal(blocked.retryAfterSeconds, 10);
  assert.equal(limiter.hit("b").ok, true, "keys are independent");

  now += 10_000;
  assert.equal(limiter.hit("a").ok, true, "new window");

  limiter.hit("a");
  limiter.reset("a");
  assert.equal(limiter.peek("a").ok, true);
});

test("client IP honors the number of trusted proxies", () => {
  const headers = new Headers({ "x-forwarded-for": "6.6.6.6, 203.0.113.9, 172.70.1.1" });
  assert.equal(getClientIp(headers), "172.70.1.1");
  assert.equal(getClientIp(headers, 2), "203.0.113.9");
  assert.equal(getClientIp(headers, 5), "6.6.6.6", "never goes past the start of the list");
  assert.equal(getClientIp(new Headers({ "x-real-ip": " 198.51.100.7 " })), "198.51.100.7");
  assert.equal(getClientIp(new Headers()), "unknown");
  assert.equal(getClientIp(new Headers({ "x-nelcota-peer-ip": "127.0.0.1" })), "127.0.0.1");
});

test("forwarding headers only count when the socket is an internal proxy", () => {
  const forged = { "x-forwarded-for": "203.0.113.1", "x-real-ip": "198.51.100.7" };
  const direct = new Headers({ ...forged, "x-nelcota-peer-ip": "198.51.100.200" });
  assert.equal(getClientIp(direct), "198.51.100.200", "straight to the app's port");
  assert.equal(
    getClientIp(new Headers({ ...forged, "x-nelcota-peer-ip": "::ffff:203.0.113.50" })),
    "203.0.113.50",
  );
  for (const proxy of [
    "10.0.1.4",
    "172.18.0.2",
    "192.168.1.1",
    "::1",
    "fd00::2",
    "::ffff:10.0.0.9",
  ]) {
    const viaProxy = new Headers({ ...forged, "x-nelcota-peer-ip": proxy });
    assert.equal(getClientIp(viaProxy), "203.0.113.1", `behind ${proxy}`);
  }
});

test("CSP allows only the app itself and LiveKit", () => {
  const prod = buildCsp({ livekitUrl: "wss://lk.exemplo.com", dev: false, nonce: "bm9uY2U=" });
  assert.match(prod, /script-src 'self' 'nonce-bm9uY2U=' 'strict-dynamic';/);
  assert.doesNotMatch(prod, /script-src[^;]*'unsafe-inline'/, "nonce replaces unsafe-inline");
  assert.match(prod, /connect-src 'self' wss:\/\/lk\.exemplo\.com https:\/\/lk\.exemplo\.com;/);
  assert.match(prod, /frame-ancestors 'none'/);
  assert.match(prod, /object-src 'none'/);
  assert.match(prod, /upgrade-insecure-requests$/);
  assert.doesNotMatch(prod, /unsafe-eval/);

  const dev = buildCsp({ livekitUrl: "ws://localhost:7880", dev: true, nonce: "bm9uY2U=" });
  assert.match(dev, /connect-src 'self' ws:\/\/localhost:7880 http:\/\/localhost:7880;/);
  assert.match(dev, /'unsafe-eval'/);
  assert.doesNotMatch(dev, /upgrade-insecure-requests/, "would break local ws://");

  const withSentry = buildCsp({
    livekitUrl: "wss://lk.exemplo.com",
    dev: false,
    nonce: "bm9uY2U=",
    sentryDsn: "https://chave@o123.ingest.sentry.io/456",
  });
  assert.match(withSentry, /connect-src [^;]*https:\/\/o123\.ingest\.sentry\.io/);

  assert.doesNotMatch(prod, /klipy/, "KLIPY only when GIFs are on");
  const withGifs = buildCsp({
    livekitUrl: "wss://lk.exemplo.com",
    dev: false,
    nonce: "bm9uY2U=",
    gifs: true,
  });
  assert.match(withGifs, /connect-src [^;]*https:\/\/api\.klipy\.com/);
  assert.match(withGifs, /img-src [^;]*https:\/\/static\.klipy\.com/);
  assert.match(withGifs, /media-src [^;]*https:\/\/static2\.klipy\.com/);
});

test("room code: normalizes and rejects invalid formats", () => {
  assert.equal(roomCodeSchema.parse("  ABC-Defg-H1J "), "abc-defg-h1j");
  for (const bad of ["a", "-abc", "abc-", "ab c", "sala_1", "á-bc", "a".repeat(33)]) {
    assert.equal(roomCodeSchema.safeParse(bad).success, false, bad);
  }
  assert.equal(roomPath("abc-defg-hij"), "/sala/abc-defg-hij");
});

test("generated codes are valid and avoid ambiguous characters", () => {
  for (let i = 0; i < 500; i++) {
    const code = generateRoomCode();
    assert.match(code, /^[a-z2-9]{3}-[a-z2-9]{4}-[a-z2-9]{3}$/);
    assert.doesNotMatch(code, /[l01]/);
    assert.equal(roomCodeSchema.parse(code), code);
  }
});

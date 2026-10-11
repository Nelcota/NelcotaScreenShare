import { getConnInfo } from "@hono/node-server/conninfo";
import { compress } from "hono/compress";
import { createHonoServer } from "react-router-hono-server/node";
import { logger } from "@/server/logger.server";

/** `pnpm start` preloads scripts/production-env.ts; the Docker image sets it in its env. */
const production = process.env.NODE_ENV === "production";

/** Header the request middleware reads for the socket address (see server/client-ip.server). */
const PEER_IP_HEADER = "x-nelcota-peer-ip";

/**
 * Hono server in front of React Router (react-router-hono-server): static assets, then the
 * app's own middleware and routes. Security headers, CSP, origin checks and rate limits stay
 * in React Router middleware and handlers.
 */
export default await createHonoServer({
  defaultLogger: false,
  onServe(server) {
    server.once("listening", () => {
      const cpu = process.cpuUsage();
      logger.info(
        {
          startup: {
            processMs: Math.round(process.uptime() * 1_000),
            cpuMs: Math.round((cpu.user + cpu.system) / 1_000),
            rssMb: Math.round(process.memoryUsage().rss / 1_048_576),
          },
        },
        "server listening",
      );
    });
  },
  beforeAll(app) {
    app.use(async (c, next) => {
      const original = c.req.raw;
      const url = new URL(original.url);
      // Behind the HTTPS proxies (Traefik, Cloudflare) the socket is plain HTTP; the scheme
      // comes from X-Forwarded-Proto. Without it, React Router refuses every action whose
      // Origin is https:// (CSRF check). Only trusted in production, behind the proxy.
      if (
        production &&
        original.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() === "https"
      )
        url.protocol = "https:";
      // Always overwritten: the no-proxy fallback comes from the socket, never the client.
      const headers = new Headers(original.headers);
      headers.set(PEER_IP_HEADER, getConnInfo(c).remote.address ?? "");
      c.req.raw = new Request(url, {
        method: original.method,
        headers,
        body: original.body,
        signal: original.signal,
        // @ts-expect-error -- Node requires duplex for a streamed body; DOM types lack it.
        duplex: "half",
      });
      await next();
    });
    if (production) app.use(compress());
  },
});

import { z } from "zod";
import { isPrivateSignalHost } from "./private-signal-host";

const emptyToUndefined = (value: unknown) =>
  typeof value === "string" && value.trim() === "" ? undefined : value;

// Postgres: accounts, rooms and settings. Use the role without DDL (nelcota_app).
const databaseUrlSchema = z.url({
  protocol: /^postgres(ql)?$/,
  error: "DATABASE_URL is required (postgres:// or postgresql://)",
});

const appUrlSchema = z.preprocess(emptyToUndefined, z.url().optional());

/**
 * Some hosts keep the quotes around a value pasted from a .env file, which breaks the
 * sender: one pair wrapping the whole value is removed. The format is checked when
 * sending (`mail.server`), so a bad sender never takes the site down.
 */
function unquoteMailFrom(value: unknown): unknown {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  const wrapped = /^(["'])(.*)\1$/s.exec(trimmed);
  return emptyToUndefined(wrapped ? wrapped[2]?.trim() : trimmed);
}

export const logLevelSchema = z.preprocess(
  emptyToUndefined,
  z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).optional(),
);

const envSchema = z
  .object({
    LIVEKIT_API_KEY: z.string({ error: "LIVEKIT_API_KEY is required" }).min(1),
    LIVEKIT_API_SECRET: z
      .string({ error: "LIVEKIT_API_SECRET is required" })
      .min(32, "LIVEKIT_API_SECRET must be at least 32 characters"),
    LIVEKIT_URL: z.url({
      protocol: /^wss?$/,
      error: "LIVEKIT_URL must be a ws:// or wss:// URL",
    }),
    // Enable only after the upstream signaling port is inaccessible to browsers.
    ROOM_HOST_CONTROLS_ENABLED: z.preprocess(
      emptyToUndefined,
      z
        .enum(["true", "false"])
        .default("false")
        .transform((value) => value === "true"),
    ),
    ACCESS_PASSWORD: z.preprocess(
      emptyToUndefined,
      z.string().min(8, "ACCESS_PASSWORD must be at least 8 characters").optional(),
    ),
    MAX_PARTICIPANTS: z.preprocess(
      emptyToUndefined,
      z.coerce.number().int().min(2).max(8).default(6),
    ),
    // Participant e-mail confirmation. Off by default: the account gets in right
    // away, without the link. "true" requires the link to join rooms.
    REQUIRE_EMAIL_VERIFICATION: z.preprocess(
      emptyToUndefined,
      z
        .enum(["true", "false"])
        .default("false")
        .transform((value) => value === "true"),
    ),
    // How many trusted proxies append IPs to X-Forwarded-For (Traefik = 1;
    // Cloudflare in front of Traefik = 2). Determines which IP the rate limit uses.
    TRUSTED_PROXY_HOPS: z.preprocess(
      emptyToUndefined,
      z.coerce.number().int().min(1).max(5).default(1),
    ),
    DATABASE_URL: databaseUrlSchema,
    // Secret of the Better Auth participant instance (cookies, encrypted 2FA).
    // Generate with: openssl rand -base64 48
    AUTH_SECRET: z
      .string({ error: "AUTH_SECRET is required (openssl rand -base64 48)" })
      .min(32, "AUTH_SECRET must be at least 32 characters"),
    // Public origin of the app (e-mail links, Better Auth CSRF). In dev: localhost.
    APP_URL: appUrlSchema,
    // Secret of the Better Auth admin instance (cookies, encrypted 2FA). Without it,
    // /admin is disabled. Generate with: openssl rand -base64 48
    ADMIN_AUTH_SECRET: z.preprocess(
      emptyToUndefined,
      z.string().min(32, "ADMIN_AUTH_SECRET must be at least 32 characters").optional(),
    ),
    // Transactional e-mail (invitations, password recovery, verification).
    // Use the Resend API or SMTP with MAIL_FROM. Without a provider, production fails
    // each delivery (logged as an error) and development logs the content.
    RESEND_API_KEY: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
    SMTP_URL: z.preprocess(
      emptyToUndefined,
      z.url({ protocol: /^smtps?$/, error: "SMTP_URL must be smtp:// or smtps://" }).optional(),
    ),
    // Sender used when none is saved in the panel (E-mails); the panel's one wins.
    MAIL_FROM: z.preprocess(unquoteMailFrom, z.string().min(3).optional()),
    // Optional observability. Only the public DSN is sent to the browser.
    SENTRY_DSN: z.preprocess(emptyToUndefined, z.url().optional()),
    PUBLIC_SENTRY_DSN: z.preprocess(emptyToUndefined, z.url().optional()),
    // Issues page of the Sentry project (e.g. https://org.sentry.io/issues/?project=123): the
    // admin panel links each recent error to its events there. Optional.
    SENTRY_ISSUES_URL: z.preprocess(emptyToUndefined, z.url({ protocol: /^https$/ }).optional()),
    // GIFs in messages. The browser calls KLIPY with this key, so it is public by design;
    // without it, the GIF button does not show.
    KLIPY_API_KEY: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
    LOG_LEVEL: logLevelSchema,
    // Commit SHA, set by CI in the image (shows up in /api/ready and in Sentry).
    APP_VERSION: z.preprocess(emptyToUndefined, z.string().max(64).optional()),
  })
  .superRefine((env, ctx) => {
    if (env.ROOM_HOST_CONTROLS_ENABLED && !isPrivateSignalHost(new URL(env.LIVEKIT_URL).hostname)) {
      ctx.addIssue({
        code: "custom",
        path: ["LIVEKIT_URL"],
        message:
          "Host controls require a private LIVEKIT_URL; fence public signaling before enabling them",
      });
    }
    if (env.RESEND_API_KEY && env.SMTP_URL) {
      ctx.addIssue({
        code: "custom",
        path: ["RESEND_API_KEY"],
        message: "Configure only one e-mail provider: RESEND_API_KEY or SMTP_URL",
      });
    }
    if (process.env.NODE_ENV !== "production") return;
    if (!env.APP_URL) {
      ctx.addIssue({
        code: "custom",
        path: ["APP_URL"],
        message: "Set APP_URL (e.g. https://app.yourdomain.com) for the e-mail links",
      });
    }
    // The sender may come from the panel, so only the provider is checked on boot.
    const mailProvider = env.RESEND_API_KEY || env.SMTP_URL;
    if ((env.REQUIRE_EMAIL_VERIFICATION || env.MAIL_FROM) && !mailProvider) {
      ctx.addIssue({
        code: "custom",
        path: ["RESEND_API_KEY"],
        message:
          "An e-mail provider (RESEND_API_KEY or SMTP_URL) is required when MAIL_FROM is set or verification is enabled",
      });
    }
    refuseDevelopmentLiveKit(env, ctx);
    if (env.ADMIN_AUTH_SECRET && env.ADMIN_AUTH_SECRET === env.AUTH_SECRET) {
      ctx.addIssue({
        code: "custom",
        path: ["ADMIN_AUTH_SECRET"],
        message: "Use different secrets for the admin panel and for participant accounts",
      });
    }
  });

/** The production build run on this machine (E2E, prints): APP_URL on loopback. */
function servesLocally(appUrlValue: string | undefined): boolean {
  if (!appUrlValue) return false;
  const host = new URL(appUrlValue).hostname;
  return host === "localhost" || host === "127.0.0.1" || host === "[::1]";
}

/**
 * The keys in deploy/livekit/livekit.dev.yaml are in the repository: with them anyone could
 * forge tokens and webhooks. A real deployment (public APP_URL) refuses them; the local
 * production build that the E2E runs against the dev LiveKit still starts.
 */
function refuseDevelopmentLiveKit(
  env: { LIVEKIT_API_KEY: string; LIVEKIT_API_SECRET: string; APP_URL?: string | undefined },
  ctx: z.RefinementCtx,
) {
  const development =
    env.LIVEKIT_API_KEY === "devkey" || env.LIVEKIT_API_SECRET.startsWith("devsecret");
  if (!development || servesLocally(env.APP_URL)) return;
  ctx.addIssue({
    code: "custom",
    path: ["LIVEKIT_API_SECRET"],
    message: "Use production LiveKit keys: the development LiveKit key and secret are public",
  });
}

/**
 * Public origin of the app (no trailing slash). Reads only APP_URL (validated by the same
 * rule as the full environment): create-owner builds the link without needing the rest.
 */
export function appUrl(): string {
  return (appUrlSchema.parse(process.env.APP_URL) ?? "http://127.0.0.1:3111").replace(/\/$/, "");
}

type Env = z.infer<typeof envSchema>;

let cached: Env | undefined;

/**
 * Reads and validates the environment variables at runtime (never inlined into the bundle).
 * The server entry calls this function on boot to fail early.
 */
export function getEnv(): Env {
  if (cached) return cached;
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(`Invalid environment variables:\n${details}`);
  }
  cached = parsed.data;
  return cached;
}

/**
 * Only the database URL, validated by the same rule as the full environment. The scripts
 * (seed, create-owner) use the database without needing the LiveKit keys etc.
 */
export function databaseUrl(): string {
  const parsed = databaseUrlSchema.safeParse(process.env.DATABASE_URL);
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Invalid DATABASE_URL");
  return parsed.data;
}

/**
 * Fails before accepting requests when required configuration is missing.
 * Coolify shows the error and does not mark the deploy as healthy.
 */
export function validateEnvOnBoot(): void {
  try {
    getEnv();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    if (process.env.NODE_ENV === "production") process.exit(1);
    throw error;
  }
}

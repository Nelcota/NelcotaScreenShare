import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const mail = vi.hoisted(() => ({
  warn: vi.fn(),
  info: vi.fn(),
  error: vi.fn(),
  sleep: vi.fn(),
  send: vi.fn(),
  createTransport: vi.fn(),
  fetch: vi.fn(),
  record: vi.fn(),
  /** The sender saved in the panel; null leaves MAIL_FROM. */
  panelSender: null as string | null,
}));

vi.mock("@/server/logger.server", () => ({
  logger: { warn: mail.warn, info: mail.info, error: mail.error },
}));
vi.mock("nodemailer", () => ({ createTransport: mail.createTransport }));
vi.mock("@/server/mail-deliveries.server", () => ({ recordMailDelivery: mail.record }));
vi.mock("node:timers/promises", () => ({ setTimeout: mail.sleep }));
// The panel's sender lives in the database; here it is a variable, MAIL_FROM otherwise.
vi.mock("@/server/mail-sender.server", () => ({
  currentMailSender: async () => {
    const { effectiveSender } = await import("@/features/admin/mail/domain/sender");
    const { getEnv } = await import("@/server/env.server");
    return effectiveSender({ sender: mail.panelSender }, getEnv().MAIL_FROM);
  },
}));

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  mail.sleep.mockResolvedValue(undefined);
  mail.record.mockResolvedValue(undefined);
  mail.panelSender = null;
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("DATABASE_URL", "postgres://app:password@localhost/nelcota");
  vi.stubEnv("LIVEKIT_API_KEY", "test-key");
  vi.stubEnv("LIVEKIT_API_SECRET", "test-livekit-secret-0123456789abcdef");
  vi.stubEnv("LIVEKIT_URL", "wss://lk.example.com");
  vi.stubEnv("AUTH_SECRET", "test-auth-secret-0123456789abcdef");
  vi.stubEnv("ADMIN_AUTH_SECRET", "");
  vi.stubEnv("APP_URL", "https://app.example.com");
  vi.stubEnv("REQUIRE_EMAIL_VERIFICATION", "false");
  vi.stubEnv("RESEND_API_KEY", "");
  vi.stubEnv("SMTP_URL", "");
  vi.stubEnv("MAIL_FROM", "");
  mail.createTransport.mockReturnValue({ sendMail: mail.send });
  vi.stubGlobal("fetch", mail.fetch);
});

afterEach(() => vi.unstubAllGlobals());

describe("production mail configuration", () => {
  test("starts without SMTP when e-mail verification is off", async () => {
    const { getEnv } = await import("@/server/env.server");
    expect(getEnv().SMTP_URL).toBeUndefined();
    expect(getEnv().REQUIRE_EMAIL_VERIFICATION).toBe(false);
  });

  test("rejects required e-mail verification without delivery", async () => {
    vi.stubEnv("REQUIRE_EMAIL_VERIFICATION", "true");
    const { getEnv } = await import("@/server/env.server");
    expect(getEnv).toThrow("An e-mail provider (RESEND_API_KEY or SMTP_URL) is required");
  });

  test("rejects a sender without a provider", async () => {
    vi.stubEnv("MAIL_FROM", "Nelcota <mail@example.com>");
    const { getEnv } = await import("@/server/env.server");
    expect(getEnv).toThrow("An e-mail provider (RESEND_API_KEY or SMTP_URL) is required");
  });

  test("starts with SMTP and no MAIL_FROM: the sender can be set in the panel", async () => {
    vi.stubEnv("SMTP_URL", "smtps://localhost:465");
    const { getEnv } = await import("@/server/env.server");
    expect(getEnv().MAIL_FROM).toBeUndefined();
  });

  test("accepts SMTP with a sender and required verification", async () => {
    vi.stubEnv("SMTP_URL", "smtps://localhost:465");
    vi.stubEnv("MAIL_FROM", "Nelcota <mail@example.com>");
    vi.stubEnv("REQUIRE_EMAIL_VERIFICATION", "true");
    const { getEnv } = await import("@/server/env.server");
    expect(getEnv().REQUIRE_EMAIL_VERIFICATION).toBe(true);
  });

  test("accepts Resend with a sender and required verification", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test_key");
    vi.stubEnv("MAIL_FROM", "Nelcota <mail@example.com>");
    vi.stubEnv("REQUIRE_EMAIL_VERIFICATION", "true");
    const { getEnv } = await import("@/server/env.server");
    expect(getEnv().RESEND_API_KEY).toBe("re_test_key");
    expect(getEnv().SMTP_URL).toBeUndefined();
    expect(getEnv().REQUIRE_EMAIL_VERIFICATION).toBe(true);
  });

  test.each([
    ['"Nelcota <no-reply@example.com>"', "Nelcota <no-reply@example.com>"],
    [" 'no-reply@example.com' ", "no-reply@example.com"],
    ['"Nelcota" <no-reply@example.com>', '"Nelcota" <no-reply@example.com>'],
  ])("normalizes the sender %s", async (configured, sender) => {
    vi.stubEnv("RESEND_API_KEY", "re_test_key");
    vi.stubEnv("MAIL_FROM", configured);
    const { getEnv } = await import("@/server/env.server");
    expect(getEnv().MAIL_FROM).toBe(sender);
  });

  test("starts with Resend and no MAIL_FROM: the sender can be set in the panel", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test_key");
    vi.stubEnv("REQUIRE_EMAIL_VERIFICATION", "true");
    const { getEnv } = await import("@/server/env.server");
    expect(getEnv().RESEND_API_KEY).toBe("re_test_key");
  });

  test("rejects multiple delivery providers", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test_key");
    vi.stubEnv("SMTP_URL", "smtps://localhost:465");
    vi.stubEnv("MAIL_FROM", "Nelcota <mail@example.com>");
    const { getEnv } = await import("@/server/env.server");
    expect(getEnv).toThrow("Configure only one e-mail provider");
  });

  test("still requires the public application origin", async () => {
    vi.stubEnv("APP_URL", "");
    const { getEnv } = await import("@/server/env.server");
    expect(getEnv).toThrow("Set APP_URL");
  });
});

describe("mail delivery", () => {
  const message = {
    to: "recipient@example.com",
    subject: "Reset password",
    text: "https://app.example.com/reset?token=private-token",
  };

  test("rejects unconfigured production delivery without exposing recipients or links", async () => {
    const { sendMail } = await import("@/server/mail.server");
    await expect(sendMail(message)).rejects.toThrow("E-mail delivery is not configured");
    expect(mail.createTransport).not.toHaveBeenCalled();
    expect(mail.warn).not.toHaveBeenCalled();
  });

  test("keeps development links in the log", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const { sendMail } = await import("@/server/mail.server");
    await sendMail(message);
    expect(mail.warn).toHaveBeenCalledWith(
      { mail: { to: message.to, subject: message.subject }, body: message.text },
      "e-mail not sent (no provider): content in the log",
    );
  });

  test("keeps recipients and links out of the log outside development", async () => {
    vi.stubEnv("NODE_ENV", "test");
    const { sendMail } = await import("@/server/mail.server");
    await sendMail(message);
    expect(mail.warn).toHaveBeenCalledWith(
      { mail: { subject: message.subject } },
      "e-mail not sent (no provider)",
    );
  });

  test("accepts a valid sender on boot without logging", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test_key");
    vi.stubEnv("MAIL_FROM", "Nelcota <no-reply@example.com>");
    const { checkMailSender } = await import("@/server/mail.server");
    checkMailSender();
    expect(mail.error).not.toHaveBeenCalled();
  });

  test("boots with an invalid sender, logs its domain and refuses to send", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test_key");
    vi.stubEnv("MAIL_FROM", "Nelcota no-reply@example.com");
    const { checkMailSender, sendMail } = await import("@/server/mail.server");
    checkMailSender();
    const misconfigured = [
      { event: "mail.misconfigured", senderDomain: "example.com" },
      'MAIL_FROM must be "no-reply@domain.com" or "Name <no-reply@domain.com>"',
    ];
    expect(mail.error).toHaveBeenCalledExactlyOnceWith(...misconfigured);
    await expect(sendMail(message)).rejects.toThrow("MAIL_FROM is not a valid sender");
    expect(mail.error).toHaveBeenLastCalledWith(...misconfigured);
    expect(mail.fetch).not.toHaveBeenCalled();
    expect(JSON.stringify(mail.error.mock.calls)).not.toMatch(/no-reply@example/);
  });

  test("preserves configured SMTP delivery", async () => {
    vi.stubEnv("SMTP_URL", "smtps://localhost:465");
    vi.stubEnv("MAIL_FROM", "Nelcota <mail@example.com>");
    const { sendMail } = await import("@/server/mail.server");
    await sendMail(message);
    expect(mail.createTransport).toHaveBeenCalledWith("smtps://localhost:465");
    expect(mail.send).toHaveBeenCalledWith({ from: "Nelcota <mail@example.com>", ...message });
  });

  test("sends from the panel's sender over MAIL_FROM", async () => {
    vi.stubEnv("SMTP_URL", "smtps://localhost:465");
    vi.stubEnv("MAIL_FROM", "Hospedagem <hosting@example.com>");
    mail.panelSender = "Nelcota <panel@example.com>";
    const { sendMail } = await import("@/server/mail.server");
    await sendMail(message);
    expect(mail.send).toHaveBeenCalledWith({ from: "Nelcota <panel@example.com>", ...message });
  });

  test("sends through Resend with only the panel's sender", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test_key");
    mail.panelSender = "Nelcota <panel@example.com>";
    mail.fetch.mockResolvedValue(new Response('{"id":"email-id"}', { status: 200 }));
    const { sendMail } = await import("@/server/mail.server");
    await sendMail(message);
    const [, request] = mail.fetch.mock.calls[0] as [string, { body: string }];
    expect(JSON.parse(request.body)).toMatchObject({ from: "Nelcota <panel@example.com>" });
  });

  test("delivers text and HTML through the Resend API", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test_key");
    vi.stubEnv("MAIL_FROM", "Nelcota <mail@example.com>");
    mail.fetch.mockResolvedValue(new Response('{"id":"email-id"}', { status: 200 }));
    const { sendMail } = await import("@/server/mail.server");
    const htmlMessage = { ...message, html: "<p>Reset password</p>" };
    await sendMail(htmlMessage);
    expect(mail.fetch).toHaveBeenCalledExactlyOnceWith("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: "Bearer re_test_key",
        "Content-Type": "application/json",
        "Idempotency-Key": expect.any(String) as string,
      },
      body: JSON.stringify({ from: "Nelcota <mail@example.com>", ...htmlMessage }),
      signal: expect.any(AbortSignal) as AbortSignal,
    });
    expect(mail.createTransport).not.toHaveBeenCalled();
    expect(mail.warn).not.toHaveBeenCalled();
    expect(mail.info).toHaveBeenCalledExactlyOnceWith(
      { event: "mail.accepted", provider: "resend", messageId: "email-id", attempt: 1 },
      "e-mail accepted by provider",
    );
  });

  test("does not retry permanent provider errors or expose the response body", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test_key");
    vi.stubEnv("MAIL_FROM", "Nelcota <mail@example.com>");
    mail.fetch.mockResolvedValue(
      new Response("recipient@example.com private-token", { status: 403 }),
    );
    const { sendMail } = await import("@/server/mail.server");
    await expect(sendMail(message)).rejects.toThrow("Resend rejected e-mail delivery (HTTP 403)");
    expect(mail.fetch).toHaveBeenCalledTimes(1);
    expect(mail.sleep).not.toHaveBeenCalled();
    expect(mail.send).not.toHaveBeenCalled();
    expect(mail.warn).toHaveBeenCalledExactlyOnceWith(
      { failure: "SyntaxError", provider: "resend" },
      "e-mail provider answer is not JSON",
    );
    expect(JSON.stringify(mail.error.mock.calls)).not.toMatch(
      /recipient|private-token|re_test_key/,
    );
  });

  test("logs Resend's error code, not its message, when it refuses a delivery", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test_key");
    vi.stubEnv("MAIL_FROM", "Nelcota <mail@example.com>");
    mail.fetch.mockResolvedValue(
      Response.json(
        {
          statusCode: 403,
          name: "validation_error",
          message: "You can only send testing emails to recipient@example.com",
        },
        { status: 403 },
      ),
    );
    const { sendMail } = await import("@/server/mail.server");
    await expect(sendMail(message)).rejects.toThrow("Resend rejected e-mail delivery (HTTP 403)");
    expect(mail.error).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "mail.failed",
        status: 403,
        reason: "validation_error",
        senderDomain: "example.com",
      }),
      "e-mail delivery failed",
    );
    expect(JSON.stringify(mail.error.mock.calls)).not.toMatch(/recipient|testing emails/);
  });

  test.each([
    Response.json({ name: "recipient@example.com", message: "private-token" }, { status: 403 }),
    new Response("recipient@example.com private-token", { status: 403 }),
    Response.json({ name: { recipient: "recipient@example.com" } }, { status: 403 }),
  ])("omits private or malformed provider diagnostics", async (response) => {
    vi.stubEnv("RESEND_API_KEY", "re_test_key");
    vi.stubEnv("MAIL_FROM", "Nelcota <mail@example.com>");
    mail.fetch.mockResolvedValue(response);
    const { sendMail } = await import("@/server/mail.server");
    await expect(sendMail(message)).rejects.toThrow("HTTP 403");
    expect(JSON.stringify([mail.warn.mock.calls, mail.error.mock.calls])).not.toMatch(
      /recipient|private-token/,
    );
    expect(mail.error).toHaveBeenCalledWith(
      expect.objectContaining({ status: 403, reason: undefined }),
      "e-mail delivery failed",
    );
    expect(mail.fetch).toHaveBeenCalledTimes(1);
  });

  test.each([429, 503])(
    "retries HTTP %s with the same payload and idempotency key",
    async (status) => {
      vi.stubEnv("RESEND_API_KEY", "re_test_key");
      vi.stubEnv("MAIL_FROM", "Nelcota <mail@example.com>");
      mail.fetch
        .mockResolvedValueOnce(new Response("private-token", { status }))
        .mockResolvedValueOnce(new Response('{"id":"email-id"}', { status: 200 }));
      const { sendMail } = await import("@/server/mail.server");
      await sendMail(message);
      expect(mail.fetch).toHaveBeenCalledTimes(2);
      const first = mail.fetch.mock.calls[0]?.[1] as RequestInit;
      const second = mail.fetch.mock.calls[1]?.[1] as RequestInit;
      expect(second.headers).toEqual(first.headers);
      expect(second.body).toBe(first.body);
      expect(mail.sleep).toHaveBeenCalledExactlyOnceWith(500);
      expect(mail.info).toHaveBeenCalledWith(
        expect.objectContaining({ event: "mail.accepted", attempt: 2 }),
        "e-mail accepted by provider",
      );
      expect(mail.send).not.toHaveBeenCalled();
    },
  );

  test("recovers from an ambiguous network failure without changing the request key", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test_key");
    vi.stubEnv("MAIL_FROM", "Nelcota <mail@example.com>");
    mail.fetch
      .mockRejectedValueOnce(new TypeError("private-token"))
      .mockResolvedValueOnce(new Response('{"id":"email-id"}', { status: 200 }));
    const { sendMail } = await import("@/server/mail.server");
    await sendMail(message);
    const first = mail.fetch.mock.calls[0]?.[1] as RequestInit;
    const second = mail.fetch.mock.calls[1]?.[1] as RequestInit;
    expect(second.headers).toEqual(first.headers);
    expect(JSON.stringify(mail.warn.mock.calls)).not.toContain("private-token");
  });

  test("bounds network retries and reports a sanitized failure", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test_key");
    vi.stubEnv("MAIL_FROM", "Nelcota <mail@example.com>");
    mail.fetch.mockRejectedValue(new TypeError("recipient@example.com private-token"));
    const { sendMail } = await import("@/server/mail.server");
    await expect(sendMail(message)).rejects.toThrow("Resend request failed or timed out");
    expect(mail.fetch).toHaveBeenCalledTimes(3);
    expect(mail.sleep.mock.calls).toEqual([[500], [1000]]);
    expect(JSON.stringify(mail.error.mock.calls)).not.toMatch(
      /recipient|private-token|re_test_key/,
    );
    expect(mail.send).not.toHaveBeenCalled();
  });

  test("assigns different keys to independent requests for the same message", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test_key");
    vi.stubEnv("MAIL_FROM", "Nelcota <mail@example.com>");
    mail.fetch.mockImplementation(() => Promise.resolve(new Response('{"id":"email-id"}')));
    const { sendMail } = await import("@/server/mail.server");
    await sendMail(message);
    await sendMail(message);
    const first = mail.fetch.mock.calls[0]?.[1] as RequestInit;
    const second = mail.fetch.mock.calls[1]?.[1] as RequestInit;
    expect(new Headers(first.headers).get("Idempotency-Key")).not.toBe(
      new Headers(second.headers).get("Idempotency-Key"),
    );
  });
});

describe("transactional mail layout", () => {
  test("escapes dynamic HTML while preserving the complete plain-text link and expiration", async () => {
    const { mailLayout } = await import("@/server/mail.server");
    const url = 'https://app.example.com/reset?token=private-token&next="quoted"';
    const content = mailLayout({
      title: "Reset <account>",
      intro: 'Hello <script>alert("name")</script>',
      action: { label: 'Continue "safely"', url },
      notice: "Valid for 30 minutes <once>",
      outro: "Ignore <unrequested> changes.",
    });
    expect(content.html).not.toContain("<script>");
    expect(content.html).toContain("&lt;script&gt;");
    expect(content.html).toContain("Valid for 30 minutes &lt;once&gt;");
    expect(content.html).toContain("private-token&amp;next=&quot;quoted&quot;");
    expect(content.text).toContain(url);
    expect(content.text).toContain("Valid for 30 minutes <once>");
  });

  test("renders notifications without an action or expiration without empty controls", async () => {
    const { mailLayout } = await import("@/server/mail.server");
    const content = mailLayout({ title: "Account notice", intro: "Your account was updated." });
    expect(content.html).toContain("Your account was updated.");
    expect(content.html).not.toContain("<a ");
    expect(content.html).not.toMatch(/undefined|null/);
    expect(content.text).toContain("Account notice");
  });
});

describe("delivery history", () => {
  const message = {
    to: "Ana <ana@Example.com>",
    subject: "Confirme seu e-mail no Nelcota",
    text: "https://app.example.com/verify?token=private-token",
  };

  test("records an accepted delivery with only the recipient's domain", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test_key");
    vi.stubEnv("MAIL_FROM", "Nelcota <mail@example.com>");
    mail.fetch.mockResolvedValue(new Response('{"id":"email-id"}', { status: 200 }));
    const { sendMail } = await import("@/server/mail.server");
    await sendMail(message);
    expect(mail.record).toHaveBeenCalledExactlyOnceWith({
      subject: "Confirme seu e-mail no Nelcota",
      recipientDomain: "example.com",
      provider: "resend",
      status: "accepted",
      reason: null,
      attempts: 1,
      providerMessageId: "email-id",
    });
  });

  test("records the provider's error code when it refuses", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test_key");
    vi.stubEnv("MAIL_FROM", "Nelcota <mail@example.com>");
    mail.fetch.mockResolvedValue(
      Response.json({ name: "validation_error", message: "ana@example.com" }, { status: 403 }),
    );
    const { sendMail } = await import("@/server/mail.server");
    await expect(sendMail(message)).rejects.toThrow("HTTP 403");
    expect(mail.record).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ status: "failed", reason: "validation_error", attempts: 1 }),
    );
    expect(JSON.stringify(mail.record.mock.calls)).not.toMatch(/ana@|private-token/);
  });

  test("records the HTTP status when the error code is unknown", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test_key");
    vi.stubEnv("MAIL_FROM", "Nelcota <mail@example.com>");
    mail.fetch.mockResolvedValue(new Response("not json", { status: 401 }));
    const { sendMail } = await import("@/server/mail.server");
    await expect(sendMail(message)).rejects.toThrow();
    expect(mail.record).toHaveBeenCalledWith(expect.objectContaining({ reason: "HTTP 401" }));
  });

  test("records SMTP refusals by their fixed error code", async () => {
    vi.stubEnv("SMTP_URL", "smtps://localhost:465");
    vi.stubEnv("MAIL_FROM", "Nelcota <mail@example.com>");
    mail.send.mockRejectedValue(
      Object.assign(new Error("Invalid login: ana@example.com"), { code: "EAUTH" }),
    );
    const { sendMail } = await import("@/server/mail.server");
    await expect(sendMail(message)).rejects.toThrow("SMTP rejected e-mail delivery");
    expect(mail.record).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ provider: "smtp", status: "failed", reason: "EAUTH" }),
    );
  });

  test("records that nothing was sent without a provider", async () => {
    const { sendMail } = await import("@/server/mail.server");
    await expect(sendMail(message)).rejects.toThrow("E-mail delivery is not configured");
    expect(mail.record).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ provider: "none", status: "not_sent", reason: "no_provider" }),
    );
  });
});

describe("sender and SMTP failures", () => {
  const message = { to: "ana@example.com", subject: "Teste", text: "corpo" };

  test("a malformed MAIL_FROM is recorded as not sent and nothing is tried", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test_key");
    vi.stubEnv("MAIL_FROM", "Nelcota no-reply");
    const { sendMail } = await import("@/server/mail.server");
    await expect(sendMail(message)).rejects.toThrow("MAIL_FROM is not a valid sender address");
    expect(mail.fetch).not.toHaveBeenCalled();
    expect(mail.record).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ provider: "resend", status: "not_sent", reason: "invalid_sender" }),
    );
  });

  test("an SMTP refusal is logged with its code only", async () => {
    vi.stubEnv("SMTP_URL", "smtps://localhost:465");
    vi.stubEnv("MAIL_FROM", "Nelcota <mail@example.com>");
    mail.send.mockRejectedValue(
      Object.assign(new Error("Invalid login: ana@example.com"), { code: "EAUTH" }),
    );
    const { sendMail } = await import("@/server/mail.server");
    await expect(sendMail(message)).rejects.toThrow();
    expect(mail.error).toHaveBeenCalledWith(
      { event: "mail.failed", provider: "smtp", reason: "EAUTH" },
      "e-mail delivery failed",
    );
    expect(JSON.stringify(mail.error.mock.calls)).not.toContain("ana@");
  });
});

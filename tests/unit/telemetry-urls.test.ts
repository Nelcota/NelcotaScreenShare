import { expect, test } from "vitest";
import { redactTelemetryUrl, redactTelemetryUrls } from "@/lib/telemetry-urls";

test("telemetry removes invitation path credentials and query/hash credentials", () => {
  const token = "sensitive-token";
  expect(
    redactTelemetryUrl(`https://example.com/times/convite/${token}?voltar=secret#password`),
  ).toBe("https://example.com/times/convite/[redacted]");
  expect(redactTelemetryUrl(`/admin/convite/${token}.data`)).toBe("/admin/convite/[redacted]");
  expect(redactTelemetryUrl("wss://example.com/api/sala/conexao/rtc?access_token=jwt")).toBe(
    "wss://example.com/api/sala/conexao/rtc",
  );
  const event = redactTelemetryUrls({
    request: { url: `/times/convite/${token}` },
    transaction: `GET /times/convite/${token}`,
    breadcrumbs: [{ data: { to: `/times/convite/${token}`, from: "/salas?private=secret" } }],
    spans: [
      {
        description: `GET /times/convite/${token}`,
        data: { "url.full": `/times/convite/${token}`, status: 200 },
      },
    ],
  });
  expect(JSON.stringify(event)).not.toContain(token);
  expect(JSON.stringify(event)).not.toContain("secret");
  expect(event.spans[0]?.data.status).toBe(200);
});

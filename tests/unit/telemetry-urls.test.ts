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

test("telemetry removes invitation tokens the SDK copies into the transaction trace context", () => {
  const token = "dummy-invite-token";

  const event = redactTelemetryUrls({
    transaction: "GET /admin/convite/:token",
    contexts: {
      trace: {
        data: {
          "url.path": `/admin/convite/${token}`,
          "url.full": `http://localhost/admin/convite/${token}`,
          "http.response.status_code": 200,
        },
      },
    },
  });

  expect(JSON.stringify(event)).not.toContain(token);
  expect(event.contexts.trace.data["http.response.status_code"]).toBe(200);
});

test("telemetry removes friend link and attachment link tokens", () => {
  const token = "bearer-token";

  const paths = [
    `/amigo/${token}`,
    `/api/arquivos/baixar/${token}`,
    `/api/arquivos/envio/${token}`,
  ].map(redactTelemetryUrl);

  expect(paths).toEqual([
    "/amigo/[redacted]",
    "/api/arquivos/baixar/[redacted]",
    "/api/arquivos/envio/[redacted]",
  ]);
  expect(redactTelemetryUrl("/amigos/pedidos")).toBe("/amigos/pedidos");
});

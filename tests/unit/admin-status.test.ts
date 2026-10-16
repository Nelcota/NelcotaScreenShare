import assert from "node:assert/strict";
import { test } from "vitest";
import { summarizeEventError } from "@/features/admin/status/domain/event-error";
import {
  checkLiveKit,
  checkMailConfiguration,
  deployInfo,
} from "@/features/admin/status/server/checks.server";

test("event errors never show query parameters", () => {
  const error = "Failed query: insert into room_participations ...\nparams: Ana,203.0.113.7";
  assert.equal(summarizeEventError(error), "Falha ao gravar no banco");
  assert.equal(
    summarizeEventError('[\n  { "code": "invalid_type" }\n]'),
    "Evento em formato inesperado",
  );
  assert.equal(summarizeEventError("room abc was not saved\nstack"), "room abc was not saved");
  assert.equal(summarizeEventError(null), "Erro sem descrição");
  assert.equal(summarizeEventError("x".repeat(300)).length, 140);
});

test("the e-mail check says what is missing without showing secrets", () => {
  const missing = checkMailConfiguration({});
  assert.equal(missing.state, "down");

  const noSender = checkMailConfiguration({ RESEND_API_KEY: "re_secret_key" });
  assert.equal(noSender.state, "down");
  assert.match(noSender.detail, /MAIL_FROM/);
  assert.doesNotMatch(noSender.detail, /re_secret_key/);

  const smtp = checkMailConfiguration({
    SMTP_URL: "smtp://user:password@mail.example.com",
    MAIL_FROM: "Nelcota <oi@example.com>",
  });
  assert.equal(smtp.state, "ok");
  assert.doesNotMatch(smtp.detail, /password|oi@example\.com/);
});

test("the LiveKit check reports open rooms or an outage", async () => {
  const up = await checkLiveKit(async () => [{}, {}]);
  assert.deepEqual(up, { state: "ok", detail: "2 salas abertas agora." });

  const down = await checkLiveKit(async () => {
    throw new Error("connect ECONNREFUSED");
  });
  assert.equal(down.state, "down");
});

test("the deployed version links to its commit only when it is a SHA", () => {
  const now = Date.parse("2026-10-11T12:00:00Z");
  const sha = deployInfo("3edf029abc", 3600, now);
  assert.equal(sha.commitUrl, "https://github.com/Nelcota/NelcotaScreenShare/commit/3edf029abc");
  assert.equal(sha.startedAt.toISOString(), "2026-10-11T11:00:00.000Z");

  assert.equal(deployInfo("preview-build", 0, now).commitUrl, null);
  assert.deepEqual(deployInfo(undefined, 0, now), {
    version: null,
    commitUrl: null,
    startedAt: new Date(now),
  });
});

test("a malformed sender shows as down without its value", () => {
  const broken = checkMailConfiguration({
    RESEND_API_KEY: "re_secret",
    MAIL_FROM: "Nelcota sem email",
  });
  assert.deepEqual(broken, { state: "down", detail: "MAIL_FROM em formato inválido." });
});

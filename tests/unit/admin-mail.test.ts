import assert from "node:assert/strict";
import { test } from "vitest";
import { mailConfiguration } from "@/features/admin/mail/domain/configuration";
import { recipientDomain } from "@/features/admin/mail/domain/delivery";
import { reasonLabel } from "@/features/admin/mail/domain/labels";
import { isValidSender } from "@/lib/mail-sender";

test("the setup warning names the missing variable, never a value", () => {
  assert.deepEqual(
    mailConfiguration({
      RESEND_API_KEY: "re_secret",
      MAIL_FROM: "a@b.c",
      REQUIRE_EMAIL_VERIFICATION: true,
    }),
    { provider: "Resend", issues: [] },
  );

  const missing = mailConfiguration({ REQUIRE_EMAIL_VERIFICATION: true });
  assert.equal(missing.provider, null);
  assert.equal(missing.issues.length, 3);
  assert.match(missing.issues.join(" "), /RESEND_API_KEY ou SMTP_URL/);
  assert.match(missing.issues.join(" "), /MAIL_FROM/);

  const smtp = mailConfiguration({
    SMTP_URL: "smtp://user:secret@host",
    REQUIRE_EMAIL_VERIFICATION: false,
  });
  assert.deepEqual(smtp, {
    provider: "SMTP",
    issues: ["Falta o remetente. Defina MAIL_FROM na hospedagem."],
  });
});

test("only the recipient's domain is kept", () => {
  assert.equal(recipientDomain("Ana <ana@Gmail.com>"), "gmail.com");
  assert.equal(recipientDomain("bruno@empresa.com.br"), "empresa.com.br");
  assert.equal(recipientDomain("sem-arroba"), null);
});

test("refusal reasons read as plain Portuguese", () => {
  assert.equal(reasonLabel("EAUTH"), "Usuário ou senha do SMTP recusados");
  assert.equal(reasonLabel("HTTP 403"), "Recusado pelo provedor: HTTP 403");
  assert.equal(reasonLabel("codigo_novo"), "codigo_novo");
  assert.equal(reasonLabel(null), "—");
});

test("a malformed sender is reported by name, never by value", () => {
  const broken = mailConfiguration({
    RESEND_API_KEY: "re_secret",
    MAIL_FROM: "Nelcota no-reply",
    REQUIRE_EMAIL_VERIFICATION: false,
  });
  assert.deepEqual(broken.issues, [
    "MAIL_FROM está em formato inválido. Use Nome <email@dominio> ou só o e-mail.",
  ]);
  assert.equal(reasonLabel("invalid_sender"), "Remetente em formato inválido");
});

test("senders the providers accept", () => {
  assert.equal(isValidSender("oi@nelcota.com"), true);
  assert.equal(isValidSender("Nelcota <oi@nelcota.com>"), true);
  assert.equal(isValidSender("Nelcota oi@nelcota.com"), false);
  assert.equal(isValidSender("<oi@nelcota>"), false);
  assert.equal(isValidSender("Nelcota"), false);
});

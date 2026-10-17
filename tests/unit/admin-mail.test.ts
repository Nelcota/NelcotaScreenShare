import assert from "node:assert/strict";
import { test } from "vitest";
import { mailConfiguration } from "@/features/admin/mail/domain/configuration";
import { recipientDomain } from "@/features/admin/mail/domain/delivery";
import { reasonLabel } from "@/features/admin/mail/domain/labels";
import { isValidSender } from "@/lib/mail-sender";

const NO_SENDER = { value: null, fromPanel: false };
const hosting = (value: string) => ({ value, fromPanel: false });

test("the setup warning names the missing variable, never a value", () => {
  assert.deepEqual(
    mailConfiguration(
      { RESEND_API_KEY: "re_secret", REQUIRE_EMAIL_VERIFICATION: true },
      hosting("a@b.c"),
    ),
    { provider: "Resend", issues: [] },
  );

  const missing = mailConfiguration({ REQUIRE_EMAIL_VERIFICATION: true }, NO_SENDER);
  assert.equal(missing.provider, null);
  assert.equal(missing.issues.length, 3);
  assert.match(missing.issues.join(" "), /RESEND_API_KEY ou SMTP_URL/);
  assert.match(missing.issues.join(" "), /Falta o remetente/);

  const smtp = mailConfiguration(
    { SMTP_URL: "smtp://user:secret@host", REQUIRE_EMAIL_VERIFICATION: false },
    NO_SENDER,
  );
  assert.deepEqual(smtp, { provider: "SMTP", issues: ["Falta o remetente."] });
  assert.doesNotMatch(smtp.issues.join(" "), /secret/);
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
  const broken = mailConfiguration(
    { RESEND_API_KEY: "re_secret", REQUIRE_EMAIL_VERIFICATION: false },
    hosting("Nelcota no-reply"),
  );
  assert.deepEqual(broken.issues, ["O MAIL_FROM da hospedagem está em formato inválido."]);
  assert.equal(reasonLabel("invalid_sender"), "Remetente em formato inválido");
});

test("senders the providers accept", () => {
  assert.equal(isValidSender("oi@nelcota.com"), true);
  assert.equal(isValidSender("Nelcota <oi@nelcota.com>"), true);
  assert.equal(isValidSender("Nelcota oi@nelcota.com"), false);
  assert.equal(isValidSender("<oi@nelcota>"), false);
  assert.equal(isValidSender("Nelcota"), false);
});

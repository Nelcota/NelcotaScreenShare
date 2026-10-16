import { isValidSender } from "@/lib/mail-sender";
import type { MailSender } from "@/features/admin/mail/domain/sender";

interface MailEnvironment {
  RESEND_API_KEY?: string;
  SMTP_URL?: string;
  REQUIRE_EMAIL_VERIFICATION: boolean;
}

export interface MailConfiguration {
  provider: "Resend" | "SMTP" | null;
  /** What is missing, naming the variable to set; never its value. */
  issues: string[];
}

function providerOf(env: MailEnvironment): MailConfiguration["provider"] {
  if (env.RESEND_API_KEY) return "Resend";
  if (env.SMTP_URL) return "SMTP";
  return null;
}

/** Reads the e-mail settings and says, in plain Portuguese, what keeps e-mails from going out. */
export function mailConfiguration(env: MailEnvironment, sender: MailSender): MailConfiguration {
  const provider = providerOf(env);
  const issues: string[] = [];
  if (!provider) {
    issues.push(
      "Nenhum provedor de e-mail configurado. Defina RESEND_API_KEY ou SMTP_URL na hospedagem.",
    );
  }
  if (!sender.value) issues.push("Falta o remetente.");
  if (sender.value && !isValidSender(sender.value)) {
    issues.push("O MAIL_FROM da hospedagem está em formato inválido.");
  }
  if (!provider && env.REQUIRE_EMAIL_VERIFICATION) {
    issues.push("A confirmação de e-mail está ligada e os links não saem.");
  }
  return { provider, issues };
}

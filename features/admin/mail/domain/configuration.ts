import { isValidSender } from "@/lib/mail-sender";

interface MailEnvironment {
  RESEND_API_KEY?: string;
  SMTP_URL?: string;
  MAIL_FROM?: string;
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
export function mailConfiguration(env: MailEnvironment): MailConfiguration {
  const provider = providerOf(env);
  const issues: string[] = [];
  if (!provider) {
    issues.push(
      "Nenhum provedor de e-mail configurado. Defina RESEND_API_KEY ou SMTP_URL na hospedagem.",
    );
  }
  if (!env.MAIL_FROM) issues.push("Falta o remetente. Defina MAIL_FROM na hospedagem.");
  if (env.MAIL_FROM && !isValidSender(env.MAIL_FROM)) {
    issues.push("MAIL_FROM está em formato inválido. Use Nome <email@dominio> ou só o e-mail.");
  }
  if (!provider && env.REQUIRE_EMAIL_VERIFICATION) {
    issues.push("A confirmação de e-mail está ligada e os links não saem.");
  }
  return { provider, issues };
}

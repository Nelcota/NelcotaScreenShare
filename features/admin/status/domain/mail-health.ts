import type { MailDeliveryStatus } from "@/features/admin/mail/domain/delivery";
import type { HealthCheck } from "./health";

export interface LastDelivery {
  status: MailDeliveryStatus;
  createdAt: Date;
}

/**
 * The e-mail card: the configuration first, then the last send. Set up right is not
 * "working" when the last e-mail did not go out (an unverified domain, a provider refusing).
 */
export function mailHealth(configuration: HealthCheck, last: LastDelivery | null): HealthCheck {
  if (configuration.state !== "ok" || !last) return configuration;
  if (last.status === "accepted") return configuration;
  return { state: "attention", detail: "O último envio não saiu. Veja o motivo em E-mails." };
}

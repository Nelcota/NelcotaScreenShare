import { sql } from "drizzle-orm";
import { check, index, pgEnum, pgTable, smallint, text } from "drizzle-orm/pg-core";
import { MAIL_DELIVERY_STATUSES, MAIL_PROVIDERS } from "@/features/admin/mail/domain/delivery";
import { createdAt, id } from "./columns";

export const mailDeliveryStatus = pgEnum("mail_delivery_status", MAIL_DELIVERY_STATUSES);
export const mailProvider = pgEnum("mail_provider", MAIL_PROVIDERS);

/**
 * One row per transactional e-mail, so the panel can say whether the provider accepted it
 * and why not. No recipient address, body or link: only the domain and safe error codes.
 * Kept 30 days (maintenance).
 */
export const mailDeliveries = pgTable(
  "mail_deliveries",
  {
    id: id(),
    subject: text("subject").notNull(),
    recipientDomain: text("recipient_domain"),
    provider: mailProvider("provider").notNull(),
    status: mailDeliveryStatus("status").notNull(),
    reason: text("reason"),
    attempts: smallint("attempts").notNull().default(0),
    providerMessageId: text("provider_message_id"),
    createdAt: createdAt(),
  },
  (table) => [
    check("mail_deliveries_subject_check", sql`length(${table.subject}) <= 200`),
    check("mail_deliveries_domain_check", sql`length(${table.recipientDomain}) <= 255`),
    check("mail_deliveries_reason_check", sql`length(${table.reason}) <= 100`),
    check("mail_deliveries_message_id_check", sql`length(${table.providerMessageId}) <= 200`),
    check("mail_deliveries_attempts_check", sql`${table.attempts} >= 0`),
    index("mail_deliveries_created_idx").on(table.createdAt.desc(), table.id.desc()),
  ],
);

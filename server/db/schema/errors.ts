import { sql } from "drizzle-orm";
import { check, index, pgTable, text } from "drizzle-orm/pg-core";
import { createdAt, id } from "./columns";

/**
 * Unexpected server errors, so the panel can list the recent ones and link each to Sentry
 * by its request id. Only a safe summary: no query parameters, e-mails or tokens.
 * Kept 30 days (maintenance).
 */
export const appErrors = pgTable(
  "app_errors",
  {
    id: id(),
    requestId: text("request_id"),
    method: text("method").notNull(),
    path: text("path").notNull(),
    name: text("name").notNull(),
    message: text("message").notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    check("app_errors_request_id_check", sql`length(${table.requestId}) <= 100`),
    check("app_errors_method_check", sql`length(${table.method}) <= 10`),
    check("app_errors_path_check", sql`length(${table.path}) <= 200`),
    check("app_errors_name_check", sql`length(${table.name}) <= 100`),
    check("app_errors_message_check", sql`length(${table.message}) <= 200`),
    index("app_errors_created_idx").on(table.createdAt.desc(), table.id.desc()),
  ],
);

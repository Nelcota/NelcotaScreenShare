import { z } from "zod";
import { defineUserOperation } from "@/features/auth/server/operation-policies.server";
import { getDb } from "@/server/db/index.server";
import { REPORT_DETAILS_MAX, REPORT_REASONS } from "./domain/reports";
import { createReport } from "./server/create-report.server";

const targetSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("user"), userId: z.uuid() }),
  z.object({ kind: z.literal("message"), messageId: z.uuid() }),
  z.object({ kind: z.literal("conversation"), conversationId: z.uuid() }),
]);

/**
 * Report a person, a message or a group (used by the messages screens and the person's card).
 * The answer says nothing about the reported person, and they never learn who reported.
 */
export const reportAction = defineUserOperation(
  { name: "reports.report", audit: "none" },
  z.object({
    target: targetSchema,
    reason: z.enum(REPORT_REASONS),
    details: z
      .string()
      .trim()
      .max(REPORT_DETAILS_MAX, `Escreva até ${REPORT_DETAILS_MAX} caracteres.`)
      .optional(),
  }),
  async ({ parsedInput, ctx }) => {
    const db = getDb();
    await db.transaction((tx) =>
      createReport(tx, ctx.current.user.id, {
        target: parsedInput.target,
        reason: parsedInput.reason,
        details: parsedInput.details || null,
      }),
    );
    return { reported: true };
  },
);

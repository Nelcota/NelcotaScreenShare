import { z } from "zod";
import { defineAdminOperation } from "@/features/auth/server/operation-policies.server";
import { ActionError } from "@/server/operations/action-error";
import { getDb } from "@/server/db/index.server";
import { appUrl } from "@/server/env.server";
import { logger } from "@/server/logger.server";
import { mailLayout, sendMail } from "@/server/mail.server";
import { createRateLimiter } from "@/server/rate-limit.server";

// A test is a click; a burst of them only spends the provider's quota.
const testLimiter = createRateLimiter({ limit: 5, windowMs: 15 * 60_000 });

/**
 * Sends a test e-mail to the admin's own address (never to a typed one, so the panel
 * cannot be used to send mail to strangers). The outcome shows up in the history.
 */
export const sendTestMailAction = defineAdminOperation(
  { name: "mail.sendTest", permission: { mail: ["test"] }, audit: "required" },
  z.object({}),
  async ({ ctx }) => {
    if (!testLimiter.hit(ctx.admin.user.id).ok) {
      throw new ActionError("Você já enviou vários testes. Aguarde alguns minutos.");
    }
    const db = getDb();
    await ctx.audit.record(db, { action: "mail.test", resourceType: "mail" });
    try {
      await sendMail({
        to: ctx.admin.user.email,
        subject: "E-mail de teste do Nelcota",
        ...mailLayout({
          title: "Os e-mails estão saindo",
          intro: `Olá, ${ctx.admin.user.name}. Este é o e-mail de teste pedido no painel.`,
          action: { label: "Abrir o painel", url: `${appUrl()}/admin/emails` },
        }),
      });
    } catch (error) {
      logger.warn(
        { failure: error instanceof Error ? error.name : "unknown" },
        "test e-mail failed",
      );
      throw new ActionError("O e-mail de teste não saiu. Veja o motivo na lista.");
    }
    return { sentTo: ctx.admin.user.email };
  },
);

import { randomInt } from "node:crypto";
import { and, eq, isNotNull, isNull } from "drizzle-orm";
import type { DbExecutor } from "@/server/db/index.server";
import { users } from "@/server/db/schema";
import { appUrl } from "@/server/env.server";
import { logger } from "@/server/logger.server";
import { mailLayout, sendMail } from "@/server/mail.server";

interface ModeratedAccount {
  name: string;
  email: string;
}

const editable = (id: string) =>
  and(eq(users.id, id), isNull(users.deletedAt), isNull(users.anonymizedAt));

/** Clears the profile photo; `null` when the account has none or is gone. */
export async function removeParticipantPhoto(
  tx: DbExecutor,
  id: string,
): Promise<ModeratedAccount | null> {
  const [changed] = await tx
    .update(users)
    .set({ image: null })
    .where(and(editable(id), isNotNull(users.image)))
    .returning({ name: users.name, email: users.email });
  return changed ?? null;
}

/** "Pessoa 4821": a neutral name the person can change again in their account. */
export function neutralName(): string {
  return `Pessoa ${randomInt(1000, 10_000)}`;
}

/** Replaces the display name; `null` when the account is gone. */
export async function resetParticipantName(
  tx: DbExecutor,
  id: string,
  name: string,
): Promise<ModeratedAccount | null> {
  const [changed] = await tx
    .update(users)
    .set({ name })
    .where(editable(id))
    .returning({ name: users.name, email: users.email });
  return changed ?? null;
}

const NOTICES = {
  photo: (account: ModeratedAccount) => ({
    subject: "Sua foto no Nelcota foi removida",
    title: "Removemos sua foto",
    intro: `Olá, ${account.name}. A equipe do Nelcota removeu a foto da sua conta.`,
    action: "Escolher outra foto",
  }),
  name: (account: ModeratedAccount) => ({
    subject: "Seu nome no Nelcota foi redefinido",
    title: "Redefinimos seu nome",
    intro: `Olá. A equipe do Nelcota trocou o nome da sua conta para ${account.name}.`,
    action: "Escolher outro nome",
  }),
} as const;

/**
 * Tells the person what changed and why. Runs after the change is saved: a failed e-mail
 * does not undo it, and the admin is told it did not go out.
 */
export async function noticeProfileChange(
  kind: keyof typeof NOTICES,
  account: ModeratedAccount,
  reason: string,
): Promise<boolean> {
  const notice = NOTICES[kind](account);
  try {
    await sendMail({
      to: account.email,
      subject: notice.subject,
      ...mailLayout({
        title: notice.title,
        intro: notice.intro,
        notice: `Motivo: ${reason}`,
        action: { label: notice.action, url: `${appUrl()}/conta` },
      }),
    });
    return true;
  } catch (error) {
    logger.warn(
      { failure: error instanceof Error ? error.name : "unknown", kind },
      "profile moderation notice failed",
    );
    return false;
  }
}

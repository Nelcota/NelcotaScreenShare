import { z } from "zod";

/**
 * Invisible characters that only serve to disguise a name: control characters, direction
 * marks that flip the text, and zero-width spaces. Joiners stay, for emoji and scripts.
 */
const INVISIBLE = /[\p{Cc}\u061C\u200B\u200E\u200F\u202A-\u202E\u2060-\u2064\u2066-\u2069\uFEFF]/gu;

/** Name the person uses in rooms (the account's), without invisible characters. */
export const displayNameSchema = z
  .string()
  .transform((name) => name.replace(INVISIBLE, ""))
  .pipe(
    z
      .string()
      .trim()
      .min(1, "Digite seu nome para entrar na sala.")
      .max(32, "Seu nome pode ter até 32 caracteres. Use um nome mais curto."),
  );

/** LiveKit identity of someone who joined through a link, without an account. */
export const GUEST_IDENTITY_PREFIX = "convidado-";

export function isGuestIdentity(identity: string): boolean {
  return identity.startsWith(GUEST_IDENTITY_PREFIX);
}

/**
 * Name shown in the room: the account's, the identity if missing, or "Alguém" with no
 * participant. Guests choose their own name, so it is marked to avoid impersonation.
 */
export function participantName(
  participant: { name?: string | undefined; identity: string } | undefined,
): string {
  if (!participant) return "Alguém";
  const name = participant.name || participant.identity;
  return isGuestIdentity(participant.identity) ? `${name} (convidado)` : name;
}

/** How the room refers to you. */
export const SELF_LABEL = "Você";

/** Name shown next to what someone did in the room: "Você" for yourself. */
export function participantLabel(
  participant: { isLocal?: boolean; name?: string | undefined; identity: string } | undefined,
): string {
  if (participant?.isLocal) return SELF_LABEL;
  return participantName(participant);
}

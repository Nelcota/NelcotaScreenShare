import { z } from "zod";
import { ROOM_CODE_PATTERN } from "@/features/room/domain/room-code";
import { BLOCKED_TERM_MESSAGE, hasBlockedTerm } from "@/features/moderation/domain/blocked-terms";

/**
 * Words a chosen address may only carry for the accounts Guilherme picks (#388): the
 * service's own name and roles, and the words of a scam link ("pix-pagamento").
 */
const RESERVED_ADDRESS_WORDS: ReadonlySet<string> = new Set([
  "nelcota",
  "admin",
  "administrador",
  "suporte",
  "ajuda",
  "oficial",
  "staff",
  "moderador",
  "moderacao",
  "equipe",
  "seguranca",
  "sistema",
  "login",
  "entrar",
  "conta",
  "senha",
  "pagamento",
  "pix",
  "verificacao",
]);

/** Reserved even inside another word, as in people's names. */
const RESERVED_ADDRESS_ROOTS: readonly string[] = ["nelcota", "admin", "suporte"];

export const ADDRESS_IN_USE_MESSAGE = "Esse endereço já está em uso. Escolha outro.";
export const RESERVED_ADDRESS_MESSAGE = "Esse endereço não pode ser usado.";

/** A chosen permanent room address: the same rule as every room code, and no blocked term. */
export const roomAddressSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(
    new RegExp(ROOM_CODE_PATTERN),
    "Use de 3 a 32 letras minúsculas, números e hífens, sem hífen no começo ou no fim.",
  )
  .refine((code) => !hasBlockedTerm(code), BLOCKED_TERM_MESSAGE);

/** Does this address carry a reserved word, as a part between hyphens or a root inside one? */
export function usesReservedWord(code: string): boolean {
  const parts = code.toLowerCase().split("-");
  if (parts.some((part) => RESERVED_ADDRESS_WORDS.has(part))) return true;
  return parts.some((part) => RESERVED_ADDRESS_ROOTS.some((root) => part.includes(root)));
}

/** Is this server message about the chosen address, so it belongs under that field? */
export function isAddressRefusal(message: string | undefined): boolean {
  return message === ADDRESS_IN_USE_MESSAGE || message === RESERVED_ADDRESS_MESSAGE;
}

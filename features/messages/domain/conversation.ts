/** A group holds up to 10 people, counting whoever created it. */
export const MAX_GROUP_MEMBERS = 10;
export const MAX_GROUP_NAME_LENGTH = 60;
export const MAX_MESSAGE_LENGTH = 2000;

/** From here the field shows how much is left. */
const LENGTH_NOTE_FROM = MAX_MESSAGE_LENGTH - 200;

const count = new Intl.NumberFormat("pt-BR");

/**
 * The counter under the message field: nothing for ordinary messages, "1.950/2.000" close
 * to the limit and, past it, the same counter marked over, so a pasted text is never cut.
 */
export function messageLengthNote(length: number): { text: string; over: boolean } | null {
  if (length < LENGTH_NOTE_FROM) return null;
  const text = `${count.format(length)}/${count.format(MAX_MESSAGE_LENGTH)}`;
  return { text, over: length > MAX_MESSAGE_LENGTH };
}

/** Messages per page when scrolling back through a conversation. */
export const MESSAGE_PAGE_SIZE = 50;
export const MAX_GIF_FAVORITES = 200;
/** KLIPY slugs: letters, digits, hyphens and underscores. */
export const GIF_SLUG_PATTERN = /^[A-Za-z0-9_-]{1,200}$/;

export type GroupCreationOutcome = "ok" | "too_few" | "too_many" | "not_friends";

export interface GroupCreationState {
  creatorId: string;
  memberIds: readonly string[];
  /** The invitees the creator is friends with, unblocked both ways. */
  friendIds: ReadonlySet<string>;
}

/** Distinct invitees, without the creator. */
export function inviteesOf(creatorId: string, memberIds: readonly string[]): string[] {
  return [...new Set(memberIds)].filter((memberId) => memberId !== creatorId);
}

/** A group needs two invitees or more, all of them the creator's friends. */
export function decideGroupCreation(state: GroupCreationState): GroupCreationOutcome {
  const invitees = inviteesOf(state.creatorId, state.memberIds);
  if (invitees.length < 2) return "too_few";
  if (invitees.length + 1 > MAX_GROUP_MEMBERS) return "too_many";
  if (invitees.some((inviteeId) => !state.friendIds.has(inviteeId))) return "not_friends";
  return "ok";
}

/** The text as it is stored: trimmed, or null when nothing is left. */
export function normalizeMessageBody(body: string | null | undefined): string | null {
  if (body === null || body === undefined) return null;
  const trimmed = body.trim();
  if (trimmed.length === 0) return null;
  return trimmed;
}

/** The group name as it is stored: trimmed, or null to show the members' names instead. */
export function normalizeGroupName(name: string | null | undefined): string | null {
  return normalizeMessageBody(name);
}

/** How a conversation's kind reads in "Baixar meus dados". */
export const CONVERSATION_KIND_IN_EXPORT: Record<"direct" | "group", string> = {
  direct: "direta",
  group: "grupo",
};

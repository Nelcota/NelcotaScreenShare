/** A group holds up to 10 people, counting whoever created it. */
export const MAX_GROUP_MEMBERS = 10;
/** Friends a group needs besides whoever creates it; one friend is a direct conversation. */
export const MIN_GROUP_INVITEES = 2;
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
  if (invitees.length < MIN_GROUP_INVITEES) return "too_few";
  if (invitees.length + 1 > MAX_GROUP_MEMBERS) return "too_many";
  if (invitees.some((inviteeId) => !state.friendIds.has(inviteeId))) return "not_friends";
  return "ok";
}

/**
 * The line above "Criar grupo" while the group is still short of people: how many friends
 * are missing or, with a single friend, why there can be no group yet. Nothing once there
 * are enough, and nothing without friends, where the list already says to add some.
 */
export function groupPickNote(pickedCount: number, friendCount: number): string | null {
  if (pickedCount >= MIN_GROUP_INVITEES) return null;
  if (friendCount === 0) return null;
  if (friendCount < MIN_GROUP_INVITEES) return "Um grupo precisa de você e mais 2 amigos.";
  const missing = MIN_GROUP_INVITEES - pickedCount;
  if (missing === 1) return "Escolha mais 1 amigo.";
  return `Escolha mais ${missing} amigos.`;
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

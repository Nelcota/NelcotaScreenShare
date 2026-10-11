/** Room activity that can be announced as a single grouped notice. */
export type GroupedNoticeKind = "joined" | "left";

/** People announced together because they arrived close to each other. */
export interface NoticeGroup {
  readonly kind: GroupedNoticeKind;
  readonly people: readonly NoticePerson[];
  readonly lastAt: number;
}

export interface NoticePerson {
  readonly identity: string;
  readonly name: string;
}

/** Notices of the same kind closer than this are announced together. */
export const NOTICE_GROUP_WINDOW_MS = 1500;

/** How many names are spelled out before "e mais N". */
const NAMED_PEOPLE_LIMIT = 3;

const SINGULAR_VERB: Record<GroupedNoticeKind, string> = {
  joined: "entrou na sala",
  left: "saiu da sala",
};

const PLURAL_VERB: Record<GroupedNoticeKind, string> = {
  joined: "entraram na sala",
  left: "saíram da sala",
};

/**
 * Adds someone to the current group of a kind, or starts a new group when the
 * previous one is missing, of another kind or older than the grouping window.
 */
export function addToNoticeGroup(
  group: NoticeGroup | undefined,
  kind: GroupedNoticeKind,
  person: NoticePerson,
  now: number,
): NoticeGroup {
  if (!group || !isGroupOpen(group, kind, now)) {
    return { kind, people: [person], lastAt: now };
  }
  const alreadyListed = group.people.some((listed) => listed.identity === person.identity);
  if (alreadyListed) return { ...group, lastAt: now };
  return { kind, people: [...group.people, person], lastAt: now };
}

function isGroupOpen(group: NoticeGroup, kind: GroupedNoticeKind, now: number): boolean {
  if (group.kind !== kind) return false;
  return now - group.lastAt <= NOTICE_GROUP_WINDOW_MS;
}

/** "Ana entrou na sala", "Ana e Beto entraram na sala", "Ana, Beto e mais 2 entraram na sala". */
export function noticeGroupMessage(group: NoticeGroup): string {
  const names = group.people.map((person) => person.name);
  if (names.length <= 1) return `${names[0] ?? "Alguém"} ${SINGULAR_VERB[group.kind]}`;
  return `${joinNames(names)} ${PLURAL_VERB[group.kind]}`;
}

function joinNames(names: readonly string[]): string {
  if (names.length > NAMED_PEOPLE_LIMIT) {
    const hidden = names.length - (NAMED_PEOPLE_LIMIT - 1);
    return `${names.slice(0, NAMED_PEOPLE_LIMIT - 1).join(", ")} e mais ${hidden}`;
  }
  const last = names.at(-1) ?? "";
  return `${names.slice(0, -1).join(", ")} e ${last}`;
}

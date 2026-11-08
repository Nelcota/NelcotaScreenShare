import type { MessageKind } from "@/features/messages/domain/conversation";

interface Person {
  id: string;
  name: string;
}

interface ConversationLike {
  kind: "direct" | "group";
  name: string | null;
  others: readonly Person[];
}

interface MessageLike {
  authorId: string;
  authorName: string;
  kind: MessageKind;
  body: string | null;
  gifSlug: string | null;
}

export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name;
}

/** "Bruno", "Bruno e Diego", "Bruno, Diego e Elisa". */
export function joinNames(names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} e ${names.at(-1)}`;
}

/** The friend's name, the group's name, or the members' first names. */
export function conversationTitle(conversation: ConversationLike): string {
  if (conversation.kind === "direct") return conversation.others[0]?.name ?? "Conversa";
  if (conversation.name) return conversation.name;
  return joinNames(conversation.others.map((person) => firstName(person.name)));
}

/**
 * What a message holds, in a word when it has no text: "GIF", "Arquivo" for a file alone, or
 * "Chamada perdida".
 */
export function messageContentLabel(
  message: Pick<MessageLike, "kind" | "body" | "gifSlug">,
): string {
  if (message.kind === "missed_call") return "Chamada perdida";
  if (message.body !== null) return message.body;
  return message.gifSlug === null ? "Arquivo" : "GIF";
}

/** The line under the name: "Você: GIF", "Felipe: alguém tem o mapa?" or just the text. */
export function messagePreview(
  message: MessageLike,
  kind: ConversationLike["kind"],
  selfId: string,
): string {
  const content = messageContentLabel(message);
  if (message.authorId === selfId) return `Você: ${content}`;
  if (kind === "group") return `${firstName(message.authorName)}: ${content}`;
  return content;
}

/**
 * Gives the friend's first name in a direct conversation.
 *
 * @param conversation - The conversation being shown.
 * @returns The other person's first name, or null in a group.
 */
export function contactName(conversation: ConversationLike): string | null {
  if (conversation.kind !== "direct") return null;
  const name = conversation.others[0]?.name;
  if (name === undefined) return null;
  return firstName(name);
}

/** "Mensagem para Carla" or "Mensagem em Noite do filme". */
export function composerPlaceholder(conversation: ConversationLike): string {
  if (conversation.kind === "direct") {
    return `Mensagem para ${firstName(conversation.others[0]?.name ?? "")}`.trim();
  }
  return `Mensagem em ${conversationTitle(conversation)}`;
}

/** What the column and the conversation's header know about a conversation. */
export interface ConversationItem {
  id: string;
  kind: "direct" | "group";
  name: string | null;
  others: Person[];
  lastMessage: (MessageLike & { createdAt: Date }) | null;
  unread: number;
  /** The direct friend's status; null for groups. */
  status: "online" | "away" | "busy" | "offline" | null;
}

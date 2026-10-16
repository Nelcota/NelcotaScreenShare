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

/** The line under the name: "Você: GIF", "Felipe: alguém tem o mapa?" or just the text. */
export function messagePreview(
  message: MessageLike,
  kind: ConversationLike["kind"],
  selfId: string,
): string {
  const content = message.body ?? "GIF";
  if (message.authorId === selfId) return `Você: ${content}`;
  if (kind === "group") return `${firstName(message.authorName)}: ${content}`;
  return content;
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

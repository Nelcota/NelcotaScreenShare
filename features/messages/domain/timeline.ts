import type { Gif } from "@/features/messages/domain/klipy";
// Times in São Paulo, the same on the server and in the browser (no hydration jump).
import { TIME_ZONE } from "@/lib/format";

const DAY_MS = 24 * 60 * 60_000;
/** Messages from the same person this close together share one name and photo. */
const RUN_GAP_MS = 5 * 60_000;

const clock = new Intl.DateTimeFormat("pt-BR", {
  timeZone: TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
});
const dayKeyFormat = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const weekday = new Intl.DateTimeFormat("pt-BR", { timeZone: TIME_ZONE, weekday: "short" });
const shortDate = new Intl.DateTimeFormat("pt-BR", {
  timeZone: TIME_ZONE,
  day: "2-digit",
  month: "2-digit",
});
const longDate = new Intl.DateTimeFormat("pt-BR", {
  timeZone: TIME_ZONE,
  day: "numeric",
  month: "long",
});
const longDateWithYear = new Intl.DateTimeFormat("pt-BR", {
  timeZone: TIME_ZONE,
  day: "numeric",
  month: "long",
  year: "numeric",
});

export interface TimelineMessage {
  id: string;
  authorId: string;
  authorName: string;
  body: string | null;
  gifSlug: string | null;
  /** Resolved on the server; null when the GIF cannot be shown. */
  gif: Gif | null;
  createdAt: Date;
}

export interface MessageRun {
  type: "messages";
  authorId: string;
  authorName: string;
  messages: TimelineMessage[];
}

/** "Bruno começou uma chamada", in a group's timeline. */
export interface TimelineCall {
  type: "call";
  id: string;
  starterName: string;
  createdAt: Date;
}

export interface TimelineDay {
  key: string;
  label: string;
  runs: (MessageRun | TimelineCall)[];
}

/** "2026-10-12" in São Paulo. */
function dayKey(date: Date): string {
  return dayKeyFormat.format(date);
}

/** Whole days between the two dates' calendar days in São Paulo. */
function daysBetween(earlier: Date, later: Date): number {
  const start = Date.parse(`${dayKey(earlier)}T00:00:00Z`);
  const end = Date.parse(`${dayKey(later)}T00:00:00Z`);
  return Math.round((end - start) / DAY_MS);
}

/** "14:32". */
export function messageTime(date: Date): string {
  return clock.format(date);
}

/** The time next to a conversation in the column: agora, 14:32, ontem, sáb or 02/10. */
export function listTime(date: Date, now: Date): string {
  if (now.getTime() - date.getTime() < 60_000) return "agora";
  const days = daysBetween(date, now);
  if (days === 0) return clock.format(date);
  if (days === 1) return "ontem";
  if (days < 7) return weekday.format(date).replace(".", "");
  return shortDate.format(date);
}

/** The divider between days: Hoje, Ontem or "10 de outubro". */
export function dayLabel(date: Date, now: Date): string {
  const days = daysBetween(date, now);
  if (days === 0) return "Hoje";
  if (days === 1) return "Ontem";
  const sameYear = dayKey(date).slice(0, 4) === dayKey(now).slice(0, 4);
  return (sameYear ? longDate : longDateWithYear).format(date);
}

function continuesRun(run: MessageRun | TimelineCall | undefined, message: TimelineMessage) {
  if (run?.type !== "messages" || run.authorId !== message.authorId) return false;
  const previous = run.messages.at(-1);
  if (!previous) return false;
  return message.createdAt.getTime() - previous.createdAt.getTime() < RUN_GAP_MS;
}

function dayOf(days: TimelineDay[], date: Date, now: Date): TimelineDay {
  const key = dayKey(date);
  const last = days.at(-1);
  if (last?.key === key) return last;
  const day = { key, label: dayLabel(date, now), runs: [] };
  days.push(day);
  return day;
}

function place(day: TimelineDay, item: TimelineMessage | TimelineCall) {
  if ("type" in item) return void day.runs.push(item);
  const run = day.runs.at(-1);
  if (run?.type === "messages" && continuesRun(run, item)) return void run.messages.push(item);
  day.runs.push({
    type: "messages",
    authorId: item.authorId,
    authorName: item.authorName,
    messages: [item],
  });
}

/** Oldest first: split by day, then into runs of the same person; call lines break runs. */
export function groupTimeline(
  messages: readonly TimelineMessage[],
  now: Date,
  calls: readonly TimelineCall[] = [],
): TimelineDay[] {
  const items = [...messages, ...calls].toSorted(
    (one, other) => one.createdAt.getTime() - other.createdAt.getTime(),
  );
  const days: TimelineDay[] = [];
  for (const item of items) place(dayOf(days, item.createdAt, now), item);
  return days;
}

/**
 * Everything seen of a conversation joined with its newest page, by id (ids sort in time
 * order). The page wins for the messages it covers: an edit shows, and a message from that
 * stretch that is no longer in it was deleted. Older messages stay, so new ones arriving
 * after "Mensagens anteriores" never open a gap.
 */
export function mergeMessages<M extends { id: string }>(
  seen: readonly M[],
  page: readonly M[],
): M[] {
  const pageStart = page[0]?.id;
  const kept = seen.filter((message) => pageStart !== undefined && message.id < pageStart);
  const byId = new Map(kept.map((message) => [message.id, message]));
  for (const message of page) byId.set(message.id, message);
  return [...byId.values()].toSorted((one, other) => (one.id < other.id ? -1 : 1));
}

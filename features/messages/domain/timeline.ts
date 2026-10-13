import type { Gif } from "@/features/messages/domain/klipy";
/** Times in São Paulo, the same on the server and in the browser (no hydration jump). */
const TIME_ZONE = "America/Sao_Paulo";

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
  authorId: string;
  authorName: string;
  messages: TimelineMessage[];
}

export interface TimelineDay {
  key: string;
  label: string;
  runs: MessageRun[];
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

function continuesRun(run: MessageRun | undefined, message: TimelineMessage): boolean {
  if (!run || run.authorId !== message.authorId) return false;
  const previous = run.messages.at(-1);
  if (!previous) return false;
  return message.createdAt.getTime() - previous.createdAt.getTime() < RUN_GAP_MS;
}

/** Oldest first: split by day, then into runs of the same person. */
export function groupTimeline(messages: readonly TimelineMessage[], now: Date): TimelineDay[] {
  const days: TimelineDay[] = [];
  for (const message of messages) {
    const key = dayKey(message.createdAt);
    let day = days.at(-1);
    if (!day || day.key !== key) {
      day = { key, label: dayLabel(message.createdAt, now), runs: [] };
      days.push(day);
    }
    const run = day.runs.at(-1);
    if (continuesRun(run, message)) {
      run?.messages.push(message);
      continue;
    }
    day.runs.push({
      authorId: message.authorId,
      authorName: message.authorName,
      messages: [message],
    });
  }
  return days;
}

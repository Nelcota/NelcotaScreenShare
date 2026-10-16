import { TZDate } from "@date-fns/tz";

/** pt-BR formatting, always in the São Paulo time zone (docs/archive/admin-plan.md §6). */
export const TIME_ZONE = "America/Sao_Paulo";

const dateTime = new Intl.DateTimeFormat("pt-BR", {
  timeZone: TIME_ZONE,
  dateStyle: "short",
  timeStyle: "short",
});
const monthYear = new Intl.DateTimeFormat("pt-BR", {
  month: "long",
  year: "numeric",
  timeZone: TIME_ZONE,
});
const relative = new Intl.RelativeTimeFormat("pt-BR", { numeric: "auto" });
const number = new Intl.NumberFormat("pt-BR");

/** Shown instead of a date that does not parse (Intl would throw a RangeError). */
const INVALID_DATE = "—";

function validTime(value: Date | string | number): number | undefined {
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? undefined : time;
}

export function formatDateTime(value: Date | string | number): string {
  const time = validTime(value);
  if (time === undefined) return INVALID_DATE;
  return dateTime.format(time);
}

/** "outubro de 2026": since when someone is a friend or a member. */
export function formatMonthYear(value: Date | string | number): string {
  const time = validTime(value);
  if (time === undefined) return INVALID_DATE;
  return monthYear.format(time);
}

export function formatNumber(value: number): string {
  return number.format(value);
}

/** "há 5 minutos", "ontem"… (relative to `now`, for tests and stable rendering). */
export function formatRelative(value: Date | string | number, now = Date.now()): string {
  const time = validTime(value);
  if (time === undefined) return INVALID_DATE;
  const seconds = Math.round((time - now) / 1000);
  const distance = Math.abs(seconds);
  // No seconds count: it changes on every render and helps nobody.
  if (distance < 60) return "agora mesmo";
  if (distance < 3600) return relative.format(Math.round(seconds / 60), "minute");
  if (distance < 86_400) return relative.format(Math.round(seconds / 3600), "hour");
  if (distance < 2_592_000) return relative.format(Math.round(seconds / 86_400), "day");
  if (distance < 31_536_000) return relative.format(Math.round(seconds / 2_592_000), "month");
  return relative.format(Math.round(seconds / 31_536_000), "year");
}

function parseDay(day: string): { year: number; month: number; date: number } | undefined {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (!match) return undefined;
  const [, year, month, date] = match.map(Number);
  if (!year || !month || !date) return undefined;
  return { year, month, date };
}

/** "2026-10-06" → start of the day in São Paulo (as a UTC Date). */
export function startOfDayInSaoPaulo(day: string): Date | undefined {
  const parsed = parseDay(day);
  if (!parsed) return undefined;
  return new Date(
    new TZDate(parsed.year, parsed.month - 1, parsed.date, 0, 0, 0, TIME_ZONE).getTime(),
  );
}

/** End of the day in São Paulo (start of the next day), for "até" (until) filters. */
export function endOfDayInSaoPaulo(day: string): Date | undefined {
  const parsed = parseDay(day);
  if (!parsed) return undefined;
  return new Date(
    new TZDate(parsed.year, parsed.month - 1, parsed.date + 1, 0, 0, 0, TIME_ZONE).getTime(),
  );
}

/** Short duration in pt-BR: "45 s", "12 min", "1 h 05 min". */
export function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  if (total < 60) return `${total} s`;
  const minutes = Math.floor(total / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  return `${hours} h ${String(minutes % 60).padStart(2, "0")} min`;
}

/** Duration between two dates; without an end, "em andamento". */
export function formatSpan(start: Date | string, end: Date | string | null): string {
  if (!end) return "em andamento";
  const startTime = validTime(start);
  const endTime = validTime(end);
  if (startTime === undefined || endTime === undefined) return INVALID_DATE;
  return formatDuration((endTime - startTime) / 1000);
}

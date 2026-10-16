import {
  COLUMN_COOKIE,
  serializeColumnLayout,
  type ColumnLayout,
} from "@/features/friends/domain/column-layout";

const ONE_YEAR_SECONDS = 365 * 24 * 60 * 60;

/** Remembers the column in this browser for the next visit. */
export function saveColumnLayout(layout: ColumnLayout): void {
  document.cookie = `${COLUMN_COOKIE}=${serializeColumnLayout(layout)}; Path=/; Max-Age=${ONE_YEAR_SECONDS}; SameSite=Lax`;
}

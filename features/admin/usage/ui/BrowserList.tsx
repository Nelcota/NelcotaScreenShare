import type { BrowserShare } from "@/features/admin/usage/server/queries.server";
import { formatNumber } from "@/lib/format";

const percent = new Intl.NumberFormat("pt-BR", { style: "percent", maximumFractionDigits: 0 });

/** Each browser with how many sign-ins and its share. */
export function BrowserList({ browsers }: { browsers: BrowserShare[] }) {
  const total = browsers.reduce((sum, browser) => sum + browser.sessions, 0);
  if (total === 0) return <p className="text-sm text-ink-muted">Nenhuma sessão aberta.</p>;
  return (
    <ul className="flex flex-col divide-y divide-line text-sm">
      {browsers.map((browser) => (
        <li key={browser.browser} className="flex items-baseline justify-between gap-4 py-2">
          <span>{browser.browser}</span>
          <span className="text-ink-muted tabular-nums">
            {formatNumber(browser.sessions)} · {percent.format(browser.sessions / total)}
          </span>
        </li>
      ))}
    </ul>
  );
}

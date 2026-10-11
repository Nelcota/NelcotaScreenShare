import { Check, Minus, Smartphone } from "lucide-react";
import type { ReactNode } from "react";
import { BROWSER_ROWS, visitorRow, type BrowserRow } from "@/features/home/domain/browser-matrix";
import { useShareSupport } from "@/features/room/hooks/use-share-support";
import { ShareSupportNote } from "@/features/room/ui/ShareSupportNote";
import { cn } from "@/lib/utils";
import { SectionIntro } from "./SectionIntro";

/** A browser's own logo, in full color, from public/browsers (from the browser-logos set). */
function Logo({ name }: { name: "chrome" | "edge" | "brave" | "firefox" | "safari" }) {
  return <img src={`/browsers/${name}.svg`} alt="" width={28} height={28} className="size-7" />;
}

/**
 * Each family's logos in their own colors (the Chromium card shows Chrome, Edge and Brave); phones
 * and tablets get a device glyph in the text color. All sit on the same neutral tile.
 */
const MARKS: Record<BrowserRow["id"], ReactNode> = {
  chromium: (
    <>
      <Logo name="chrome" />
      <Logo name="edge" />
      <Logo name="brave" />
    </>
  ),
  firefox: <Logo name="firefox" />,
  safari: <Logo name="safari" />,
  mobile: <Smartphone className="size-6" aria-hidden="true" />,
};

function Capability({ on, label }: { on: boolean; label: string }) {
  const Icon = on ? Check : Minus;
  return (
    <li className="flex items-center justify-between gap-3 py-2.5">
      <span className={on ? "" : "text-ink-subtle"}>{label}</span>
      <Icon
        className={cn("size-4 shrink-0", on ? "text-success" : "text-ink-subtle")}
        aria-hidden="true"
      />
      <span className="sr-only">{on ? "sim" : "não"}</span>
    </li>
  );
}

/**
 * "Will it work here?" as one card per browser family: what it shares, in a sentence and
 * two checks. The visitor's own browser lights up once the page knows it (after hydration).
 */
export function BrowserCheckSection() {
  const support = useShareSupport();
  const current = visitorRow(support);

  return (
    <section aria-labelledby="browsers-title" className="w-full max-w-5xl">
      <SectionIntro
        id="browsers-title"
        title="Funciona no seu navegador?"
        subtitle="Veja o que cada um faz."
        align="center"
      />

      <ul
        data-fx
        aria-label="O que cada navegador faz na sala"
        className="mt-12 grid gap-4 sm:mt-16 sm:grid-cols-2 lg:grid-cols-4"
      >
        {BROWSER_ROWS.map((row) => {
          const here = row.id === current;
          return (
            <li
              key={row.id}
              data-fx-item
              aria-current={here || undefined}
              className="flex flex-col gap-5 rounded-3xl border border-line p-6 transition-colors duration-(--motion-feedback) hover:border-line-strong aria-[current]:border-brand"
            >
              <span className="flex flex-wrap items-start justify-between gap-3">
                <span className="flex h-12 min-w-12 items-center justify-center gap-1.5 rounded-2xl bg-surface-2 px-2.5 text-ink">
                  {MARKS[row.id]}
                </span>
                {here ? (
                  <span className="rounded-full bg-brand px-2.5 py-1 text-xs font-medium whitespace-nowrap text-brand-ink">
                    Você está aqui
                  </span>
                ) : null}
              </span>
              <span className="flex flex-col gap-1">
                <span className="text-lg leading-snug font-semibold tracking-[-0.02em]">
                  {row.name}
                </span>
                <span className="text-sm text-ink-muted">{row.summary}</span>
              </span>
              <ul className="mt-auto divide-y divide-line border-t border-line text-sm">
                <Capability on={row.screen} label="Compartilha a tela" />
                <Capability on={row.audio} label="Som do computador" />
              </ul>
            </li>
          );
        })}
      </ul>

      <div className="mt-6 flex flex-col items-center gap-3 text-center text-sm text-ink-muted">
        {/* A browser none of the cards describe still gets its own answer. */}
        {support !== null && current === null ? <ShareSupportNote /> : null}
        <p>Em qualquer um deles você assiste, fala e usa o chat.</p>
      </div>
    </section>
  );
}

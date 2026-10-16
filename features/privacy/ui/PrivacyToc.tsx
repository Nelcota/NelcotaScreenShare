import { useEffect, useRef, useState, type RefObject } from "react";
import { activeSection } from "@/features/privacy/domain/active-section";
import { cn } from "@/lib/utils";

export interface PrivacyTocItem {
  id: string;
  label: string;
}

/** A third of the screen down: a section whose title passed it is the one being read. */
const READING_LINE = 1 / 3;

/** On phones the bar scrolls sideways: keeps the active pill in view. */
function centerPill(list: HTMLOListElement | null, id: string) {
  const pill = list?.querySelector<HTMLElement>(`a[href="#${id}"]`);
  if (!list || !pill) return;
  const left = pill.offsetLeft - (list.clientWidth - pill.offsetWidth) / 2;
  list.scrollTo({ left, behavior: "smooth" });
}

function readSection(items: readonly PrivacyTocItem[]) {
  const tops = items.flatMap((item) => {
    const element = document.getElementById(item.id);
    return element ? [{ id: item.id, top: element.getBoundingClientRect().top }] : [];
  });
  const atPageEnd =
    window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2;
  return activeSection(tops, window.innerHeight * READING_LINE, atPageEnd);
}

/** The section on screen, followed while the page scrolls (one reading per frame). */
function useActiveSection(
  items: readonly PrivacyTocItem[],
  list: RefObject<HTMLOListElement | null>,
) {
  const [active, setActive] = useState(items[0]?.id ?? "");
  useEffect(() => {
    let frame = 0;
    let shown: string | undefined;
    const update = () => {
      frame = 0;
      const id = readSection(items);
      if (!id || id === shown) return;
      shown = id;
      setActive(id);
      centerPill(list.current, id);
    };
    const schedule = () => {
      if (frame) return;
      frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, [items, list]);
  return active;
}

/**
 * Section bar of the notice, sticky at the top while scrolling: highlights the pill
 * of the section being read. Without JavaScript, it is still a plain anchor list.
 */
export function PrivacyToc({ items }: { items: PrivacyTocItem[] }) {
  const listRef = useRef<HTMLOListElement>(null);
  const active = useActiveSection(items, listRef);

  return (
    <nav aria-label="Nesta página" className="glass rounded-2xl p-1.5">
      <ol
        ref={listRef}
        className="relative flex [scrollbar-width:none] gap-1 overflow-x-auto [&::-webkit-scrollbar]:hidden"
      >
        {items.map((item) => {
          const current = item.id === active;
          return (
            <li key={item.id} className="shrink-0 sm:flex-1">
              <a
                href={`#${item.id}`}
                aria-current={current ? "location" : undefined}
                className={cn(
                  "flex h-9 items-center justify-center rounded-xl px-3.5 text-sm font-semibold whitespace-nowrap transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                  current
                    ? "bg-brand/15 text-brand-soft"
                    : "text-ink-muted hover:bg-surface-3 hover:text-ink",
                )}
              >
                {item.label}
              </a>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

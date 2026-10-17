import { HomeStart } from "@/features/home/ui/HomeStart";
import { cn } from "@/lib/utils";

/** The one line that tells a first visit what to do here. */
const START_LINE = "Crie uma sala e chame seus amigos";

/**
 * The middle of the app when nothing is picked in the column (any tab): the landing's pair
 * of mascots and the "Link ou código da sala" bar, under one line saying what to do. Picking
 * a friend or a conversation replaces it with their page.
 */
export function AppEmptyState({
  title,
  invalidCode = false,
  className,
}: {
  /** The page's h1, for screen readers: the screen itself has no title to show. */
  title: string;
  invalidCode?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex min-h-full flex-col items-center justify-center px-4 py-16 sm:py-10",
        className,
      )}
    >
      <h1 className="sr-only">{title}</h1>
      <p className="mb-8 text-center text-2xl font-semibold tracking-tight text-balance text-ink">
        {START_LINE}
      </p>
      <div className="w-full max-w-md">
        <HomeStart invalidCode={invalidCode} compact />
      </div>
    </div>
  );
}

import { HomeStart } from "@/features/home/ui/HomeStart";
import { cn } from "@/lib/utils";

/**
 * The middle of the app when nothing is picked in the column (any tab): the landing's pair
 * of mascots and the "Link ou código da sala" bar. Picking a friend or a conversation
 * replaces it with their page.
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
      <div className="w-full max-w-md">
        <HomeStart invalidCode={invalidCode} compact />
      </div>
    </div>
  );
}

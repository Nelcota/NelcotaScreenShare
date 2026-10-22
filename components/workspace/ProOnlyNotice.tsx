import type { LucideIcon } from "lucide-react";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * A Pro-only page or part without Pro: what it is, that it is Pro only, and the way to the
 * Pro list. Times and Salas share it, so both say it the same way.
 */
export function ProOnlyNotice({
  icon: Icon,
  title,
  description,
  note,
  heading = "h1",
  className,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  /** Said after "Só no Pro.": what to do meanwhile. */
  note: string;
  /** h1 when the notice is the whole page; h2 inside a page that has its own title. */
  heading?: "h1" | "h2";
  className?: string;
}) {
  const Heading = heading;
  return (
    <section
      className={cn("flex flex-col items-center justify-center gap-3 text-center", className)}
    >
      <span className="grid size-13 place-items-center rounded-2xl bg-brand/15 text-brand-soft">
        <Icon className="size-6" aria-hidden="true" />
      </span>
      <Heading className="mt-1 text-2xl font-semibold tracking-tight">{title}</Heading>
      <p className="max-w-sm text-ink-muted">{description}</p>
      <p className="max-w-sm">
        <span className="font-medium">Só no Pro.</span>{" "}
        <span className="text-ink-muted">{note}</span>
      </p>
      <Button asChild className="mt-2">
        <Link viewTransition to="/#precos">
          Entrar na lista do Pro
        </Link>
      </Button>
    </section>
  );
}

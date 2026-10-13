import { UserPlus } from "lucide-react";
import { Hint } from "@/components/Hint";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { AddFriendPanel } from "@/features/friends/ui/AddFriendPanel";
import { cn } from "@/lib/utils";

/** "Chamar" and this button share the outlined look: green fill only on hover or focus. */
const OUTLINED_BRAND =
  "border border-brand-soft/70 text-brand-soft transition-colors hover:border-brand hover:bg-brand hover:text-brand-ink focus-visible:border-brand focus-visible:bg-brand focus-visible:text-brand-ink focus-visible:outline-none";

/** A small round button that opens "Adicionar amigo" in a window. */
export function AddFriendDialog({
  code,
  linkPath,
  className,
}: {
  code: string;
  linkPath: string;
  className?: string;
}) {
  return (
    <Dialog>
      <Hint text="Adicionar amigo">
        <DialogTrigger
          aria-label="Adicionar amigo"
          className={cn(
            "grid size-9 shrink-0 place-items-center rounded-full",
            OUTLINED_BRAND,
            className,
          )}
        >
          <UserPlus className="size-4" aria-hidden="true" />
        </DialogTrigger>
      </Hint>
      <DialogContent className="max-w-md rounded-3xl">
        <DialogTitle>Adicionar amigo</DialogTitle>
        <DialogDescription className="sr-only">
          Seu código para passar adiante e o campo para o e-mail ou código de outra pessoa.
        </DialogDescription>
        <AddFriendPanel code={code} linkPath={linkPath} />
      </DialogContent>
    </Dialog>
  );
}

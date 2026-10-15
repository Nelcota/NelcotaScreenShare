import { UserPlus } from "lucide-react";
import { Hint } from "@/components/Hint";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { AddFriendPanel } from "@/features/friends/ui/AddFriendPanel";

function AddFriendContent({
  code,
  linkPath,
  onCloseAutoFocus,
}: {
  code: string;
  linkPath: string;
  onCloseAutoFocus?: (event: Event) => void;
}) {
  return (
    <DialogContent className="max-w-md" onCloseAutoFocus={onCloseAutoFocus}>
      <DialogTitle>Adicionar amigo</DialogTitle>
      <DialogDescription className="sr-only">
        Seu código para passar adiante e o campo para o e-mail ou código de outra pessoa.
      </DialogDescription>
      <AddFriendPanel code={code} linkPath={linkPath} />
    </DialogContent>
  );
}

/** "Adicionar amigo" in a window opened from elsewhere (the "+" menu). */
export function AddFriendWindow({
  code,
  linkPath,
  open,
  onOpenChange,
  onCloseAutoFocus,
}: {
  code: string;
  linkPath: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCloseAutoFocus: (event: Event) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <AddFriendContent code={code} linkPath={linkPath} onCloseAutoFocus={onCloseAutoFocus} />
    </Dialog>
  );
}

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
        <DialogTrigger asChild>
          <Button
            variant="brand-outline"
            size="icon-lg"
            aria-label="Adicionar amigo"
            className={className}
          >
            <UserPlus aria-hidden="true" />
          </Button>
        </DialogTrigger>
      </Hint>
      <AddFriendContent code={code} linkPath={linkPath} />
    </Dialog>
  );
}

import { Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCreateRoom } from "@/features/home/hooks/use-create-room";

/**
 * "Criar sala grátis" outside the hero bar. Visitors go through sign-up first.
 */
export function CreateRoomButton({
  variant = "default",
  className,
}: {
  variant?: "default" | "secondary";
  className?: string;
}) {
  const { createRoom, pending } = useCreateRoom();

  return (
    <Button
      size="lg"
      variant={variant}
      disabled={pending}
      className={className}
      onClick={createRoom}
    >
      {pending ? (
        <Loader2 className="animate-spin" aria-hidden="true" />
      ) : (
        <Plus className="icon-turn" aria-hidden="true" />
      )}
      {pending ? "Abrindo…" : "Criar sala grátis"}
    </Button>
  );
}

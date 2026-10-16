import { Plus } from "lucide-react";
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
      loading={pending}
      className={className}
      onClick={createRoom}
    >
      {pending ? null : <Plus className="icon-turn" aria-hidden="true" />}
      {pending ? "Abrindo…" : "Criar sala grátis"}
    </Button>
  );
}

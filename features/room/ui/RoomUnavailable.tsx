import { ArrowLeft, Ban, DoorClosed } from "lucide-react";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import { StatusScreen } from "@/features/room/ui/StatusScreen";

const SCREENS = {
  missing: { icon: DoorClosed, title: "Esta sala não existe", message: "Confira o link." },
  banned: {
    icon: Ban,
    title: "Você não pode voltar a esta chamada",
    message: "Quando ela terminar, o link volta a funcionar.",
  },
} as const;

export type RoomUnavailableReason = keyof typeof SCREENS;

/** A room the person cannot enter: no pre-join form, only the way back. */
export function RoomUnavailable({ reason }: { reason: RoomUnavailableReason }) {
  const { icon, title, message } = SCREENS[reason];
  return (
    <main className="flex min-h-dvh items-center justify-center px-4">
      <StatusScreen icon={icon} title={title} message={message} alert>
        <Button size="lg" asChild>
          <Link to="/" viewTransition>
            <ArrowLeft aria-hidden="true" />
            Voltar ao início
          </Link>
        </Button>
      </StatusScreen>
    </main>
  );
}

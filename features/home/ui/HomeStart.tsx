import { useTransition } from "react";
import { useNavigate, useRouteLoaderData } from "react-router";
import { toast } from "sonner";
import type { loader as rootLoader } from "@/app/root";
import { addFriend } from "@/features/friends/actions";
import { ADD_FRIEND_DONE } from "@/features/friends/domain/friendship";
import { useOperation } from "@/lib/operations/use-operation";
import { MascotPair } from "@/features/mascot/ui/MascotPair";
import { useCreateRoom } from "@/features/home/hooks/use-create-room";
import { roomPath } from "@/features/room/domain/room-code";
import { useActiveCallCode } from "@/features/room/hooks/use-active-call";
import { SmartBar } from "./SmartBar";

/** "Link or code" bar with the pair of mascots, which reacts while the room opens. */
export function HomeStart({
  invalidCode,
  focusShortcut,
  compact = false,
}: {
  invalidCode: boolean;
  /** The start of the app: smaller mascots and bar. */
  compact?: boolean;
  /** Off for a second bar on the page, so "/" keeps going to the first. */
  focusShortcut?: boolean;
}) {
  const navigate = useNavigate();
  const signedIn = Boolean(useRouteLoaderData<typeof rootLoader>("root")?.account);
  const add = useOperation(addFriend, {
    onSuccess: ({ data }) => toast.success(ADD_FRIEND_DONE[data.status]),
    onError: ({ error }) => toast.error(error.serverError ?? "Não foi possível agora."),
  });
  const [joining, startTransition] = useTransition();
  const creating = useCreateRoom();
  const pending = joining || creating.pending;
  const activeCall = useActiveCallCode();

  // Keeps the content visible while the route loads. Pending also ends when navigating back.
  function openRoom(href: string) {
    startTransition(() => navigate(href, { viewTransition: true }));
  }

  return (
    <SmartBar
      // A new ?erro=codigo starts the bar over, so its message shows again.
      key={invalidCode ? "codigo-invalido" : "barra"}
      invalidCode={invalidCode}
      pending={pending}
      onNavigate={openRoom}
      onCreateRoom={creating.createRoom}
      onBackToCall={
        activeCall ? () => void navigate(roomPath(activeCall), { viewTransition: true }) : undefined
      }
      mascot={<MascotPair pending={pending} compact={compact} />}
      focusShortcut={focusShortcut}
      compact={compact}
      onAddFriend={signedIn ? (code) => add.execute({ target: code }) : undefined}
    />
  );
}

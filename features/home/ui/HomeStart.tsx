import { useTransition } from "react";
import { useNavigate } from "react-router";
import { MascotPair } from "@/features/mascot/ui/MascotPair";
import { useCreateRoom } from "@/features/home/hooks/use-create-room";
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
  const [joining, startTransition] = useTransition();
  const creating = useCreateRoom();
  const pending = joining || creating.pending;

  // Keeps the content visible while the route loads. Pending also ends when navigating back.
  function openRoom(href: string) {
    startTransition(() => navigate(href, { viewTransition: true }));
  }

  return (
    <SmartBar
      invalidCode={invalidCode}
      pending={pending}
      onNavigate={openRoom}
      onCreateRoom={creating.createRoom}
      mascot={<MascotPair pending={pending} compact={compact} />}
      focusShortcut={focusShortcut}
      compact={compact}
    />
  );
}

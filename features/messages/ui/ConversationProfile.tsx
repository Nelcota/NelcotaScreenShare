import { UserRound } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router";
import { Hint } from "@/components/Hint";
import { Button } from "@/components/ui/button";
import { useStoredValue } from "@/lib/hooks/use-stored-value";
import { createStoredValue } from "@/lib/stored-value";

/** The friend's profile beside a direct conversation; on phones, their card instead. */
export interface ConversationProfile {
  panel: ReactNode;
  /** Where "Perfil" goes when there is no room for the panel. */
  link: string;
}

const profileOpen = createStoredValue<boolean>({
  key: "nelcota-conversation-profile",
  changeEvent: "nelcota-conversation-profile-change",
  fallback: true,
  parse: (raw) => raw !== "closed",
  serialize: (open) => (open ? "open" : "closed"),
  warning: "Could not access the conversation profile storage",
});

/** Whether the profile panel is open, remembered in this browser (open by default). */
export function useProfileOpen() {
  const open = useStoredValue(profileOpen, true);
  return { open, toggle: () => profileOpen.write(!open) };
}

/** "Perfil": opens or closes the panel on wide screens, the friend's card on narrow ones. */
export function ProfileToggle({
  profile,
  open,
  onToggle,
}: {
  profile: ConversationProfile;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <>
      <Hint text={open ? "Esconder perfil" : "Mostrar perfil"}>
        <Button
          type="button"
          variant="quiet"
          size="icon-lg"
          aria-label="Perfil"
          aria-pressed={open}
          onClick={onToggle}
          className="max-lg:hidden"
        >
          <UserRound className="size-5" aria-hidden="true" />
        </Button>
      </Hint>
      <Button asChild variant="quiet" size="icon-lg" className="lg:hidden">
        <Link viewTransition to={profile.link} aria-label="Perfil">
          <UserRound className="size-5" aria-hidden="true" />
        </Link>
      </Button>
    </>
  );
}

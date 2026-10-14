import { UserRound } from "lucide-react";
import { useSyncExternalStore, type ReactNode } from "react";
import { Link } from "react-router";
import { Hint } from "@/components/Hint";
import { Button } from "@/components/ui/button";

/** The friend's profile beside a direct conversation; on phones, their card instead. */
export interface ConversationProfile {
  panel: ReactNode;
  /** Where "Perfil" goes when there is no room for the panel. */
  link: string;
}

const PROFILE_KEY = "nelcota-conversation-profile";
const PROFILE_EVENT = "nelcota-conversation-profile-change";

function readProfileOpen(): boolean {
  try {
    return window.localStorage.getItem(PROFILE_KEY) !== "closed";
  } catch {
    return true;
  }
}

function saveProfileOpen(open: boolean) {
  try {
    window.localStorage.setItem(PROFILE_KEY, open ? "open" : "closed");
  } catch {
    // Private windows may refuse storage; the panel simply forgets.
  }
  window.dispatchEvent(new Event(PROFILE_EVENT));
}

function subscribe(changed: () => void) {
  window.addEventListener(PROFILE_EVENT, changed);
  window.addEventListener("storage", changed);
  return () => {
    window.removeEventListener(PROFILE_EVENT, changed);
    window.removeEventListener("storage", changed);
  };
}

/** Whether the profile panel is open, remembered in this browser (open by default). */
export function useProfileOpen() {
  const open = useSyncExternalStore(subscribe, readProfileOpen, () => true);
  return { open, toggle: () => saveProfileOpen(!open) };
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

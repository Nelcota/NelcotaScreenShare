import { UserRound } from "lucide-react";
import { useSyncExternalStore, type ReactNode } from "react";
import { Link } from "react-router";
import { Hint } from "@/components/Hint";
import { cn } from "@/lib/utils";

/** The friend's profile beside a direct conversation; on phones, their card instead. */
export interface ConversationProfile {
  panel: ReactNode;
  /** Where "Perfil" goes when there is no room for the panel. */
  link: string;
}

const HEADER_ICON =
  "grid size-9 shrink-0 place-items-center rounded-full text-ink-muted transition-colors hover:bg-surface-3 hover:text-ink focus-visible:outline-2 focus-visible:outline-brand";

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
        <button
          type="button"
          aria-label="Perfil"
          aria-pressed={open}
          onClick={onToggle}
          className={cn(
            HEADER_ICON,
            "aria-pressed:bg-surface-3 aria-pressed:text-ink max-lg:hidden",
          )}
        >
          <UserRound className="size-5" aria-hidden="true" />
        </button>
      </Hint>
      <Link
        viewTransition
        to={profile.link}
        aria-label="Perfil"
        className={cn(HEADER_ICON, "lg:hidden")}
      >
        <UserRound className="size-5" aria-hidden="true" />
      </Link>
    </>
  );
}

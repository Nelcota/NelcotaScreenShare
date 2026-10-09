import { useState, useSyncExternalStore } from "react";
import { subscribeNothing } from "@/lib/hooks/subscribe-nothing";

/** A guest's last name, so a second invite does not ask again (per browser, best effort). */
const STORAGE_KEY = "nelcota:nome-convidado";

function storedName(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

/** Saves a guest's name for the next invite (also when they rename themselves in a call). */
export function rememberName(name: string) {
  try {
    localStorage.setItem(STORAGE_KEY, name);
  } catch {
    // Private mode or blocked storage: the field just starts empty next time.
  }
}

/**
 * The name a guest types before joining. It starts from the one saved in this browser
 * (read after hydration: the server does not know it) until the person edits it.
 */
export function useGuestName() {
  const stored = useSyncExternalStore(subscribeNothing, storedName, () => "");
  const [draft, setDraft] = useState<string>();
  return { name: draft ?? stored, setName: setDraft, remember: rememberName };
}

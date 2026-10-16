import { createContext, use } from "react";
import { createKlipy, type Klipy } from "@/features/messages/client/klipy";

/** The KLIPY client of the open conversation; null when GIFs are off (no key). */
export const KlipyContext = createContext<Klipy | null>(null);

const clients = new Map<string, Klipy>();

/** One client per key for the whole page. */
export function klipyFor(key: string | null): Klipy | null {
  if (!key) return null;
  const existing = clients.get(key);
  if (existing) return existing;
  const created = createKlipy(key);
  clients.set(key, created);
  return created;
}

export function useKlipy(): Klipy | null {
  return use(KlipyContext);
}

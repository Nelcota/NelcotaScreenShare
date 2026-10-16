import { useSyncExternalStore } from "react";
import type { StoredValue } from "@/lib/stored-value";

/** The stored value, kept current; `serverValue` renders during SSR and hydration. */
export function useStoredValue<T>(store: StoredValue<T>, serverValue: T): T {
  return useSyncExternalStore(store.subscribe, store.read, () => serverValue);
}

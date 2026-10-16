import { useState } from "react";
import { hasHadCompany } from "@/features/room/domain/room-company";

/** Remembers, for as long as the call is mounted, whether anyone else has joined. */
export function useHadCompany(company: { connectedOnce: boolean; others: number }): boolean {
  const [hadCompany, setHadCompany] = useState(false);
  const next = hasHadCompany(hadCompany, company);
  // Adjusting state while rendering: the alone screen already shows the right copy.
  if (next !== hadCompany) setHadCompany(next);
  return next;
}

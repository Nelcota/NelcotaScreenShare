/** What the room's people area shows: nothing until the first connection, then alone or the grid. */
export type PeopleView = "pending" | "alone" | "grid";

/**
 * People in the call besides me. My own identity from another tab or browser does not
 * count: it shows up for a moment while connecting, until the server drops the old one.
 */
export function othersInCall(localIdentity: string, identities: readonly string[]): number {
  return identities.filter((identity) => identity !== localIdentity).length;
}

/**
 * Before the first connection the list holds only me, so deciding then would draw the grid
 * and jump to the alone screen a moment later. A stage always takes the grid's place.
 */
export function peopleView({
  connectedOnce,
  hasStage,
  others,
}: {
  connectedOnce: boolean;
  hasStage: boolean;
  others: number;
}): PeopleView {
  if (hasStage) return "grid";
  if (!connectedOnce) return "pending";
  if (others === 0) return "alone";
  return "grid";
}

/**
 * Whether someone else has been in the call during this connection. Once true it stays
 * true: being alone afterwards means everyone left, not that nobody has arrived yet.
 * Only counted once connected, when the list of people is the server's.
 */
export function hasHadCompany(
  hadCompanyBefore: boolean,
  { connectedOnce, others }: { connectedOnce: boolean; others: number },
): boolean {
  if (hadCompanyBefore) return true;
  if (!connectedOnce) return false;
  return others > 0;
}

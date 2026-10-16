/** Someone in the people area, as far as the order cares. */
interface Person {
  identity: string;
  isLocal: boolean;
}

/** Someone else is showing a screen: the people area puts them before you. */
export function othersPresenting(people: readonly Person[], sharingIds: ReadonlySet<string>) {
  return people.some((person) => !person.isLocal && sharingIds.has(person.identity));
}

/**
 * Who presents comes first, where "Assistir" is in reach; while someone else presents, your
 * own tile goes last. Everyone else keeps the call's order.
 */
export function peopleOrder<T extends Person>(
  people: readonly T[],
  sharingIds: ReadonlySet<string>,
) {
  const presenting = people.filter((person) => sharingIds.has(person.identity));
  const ordered = [...presenting, ...people.filter((person) => !sharingIds.has(person.identity))];
  if (!othersPresenting(people, sharingIds)) return ordered;
  return [
    ...ordered.filter((person) => !person.isLocal),
    ...ordered.filter((person) => person.isLocal),
  ];
}

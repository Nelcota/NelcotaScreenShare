/**
 * Empty elements a page leaves (by id) for another feature to fill through a portal. The
 * element registers itself with `pageSlotRef`, so nobody has to watch the whole DOM for it.
 */
const slots = new Map<string, HTMLElement>();
const listeners = new Set<() => void>();
const refs = new Map<string, (element: HTMLElement | null) => (() => void) | undefined>();

function notify() {
  for (const listener of listeners) listener();
}

export function subscribePageSlots(onChange: () => void) {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

export function pageSlot(id: string): HTMLElement | null {
  return slots.get(id) ?? null;
}

/** The ref for the slot element; the same function on every render, so it registers once. */
export function pageSlotRef(id: string) {
  const known = refs.get(id);
  if (known) return known;
  const ref = (element: HTMLElement | null) => {
    if (!element) return undefined;
    slots.set(id, element);
    notify();
    return () => {
      if (slots.get(id) === element) slots.delete(id);
      notify();
    };
  };
  refs.set(id, ref);
  return ref;
}

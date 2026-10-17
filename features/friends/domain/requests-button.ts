/** Past this the button reads "99+", like the other counts. */
const MAX_SHOWN = 99;

/** What the requests button says: how many are waiting or, with none, "Pedidos". */
export function requestsButtonText(count: number): string {
  if (count <= 0) return "Pedidos";
  if (count > MAX_SHOWN) return `${MAX_SHOWN}+`;
  return String(count);
}

/** The button's accessible name, with the exact count. */
export function requestsButtonLabel(count: number): string {
  if (count > 0) return `Pedidos de amizade: ${count}`;
  return "Pedidos de amizade";
}

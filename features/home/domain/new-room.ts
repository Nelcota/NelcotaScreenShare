/** Back on the home page with this address, a signed-in person's "Criar sala" runs by itself. */
export const CREATE_ROOM_RETURN = "/?criar=sala";

/**
 * Where "Criar sala" sends someone the server did not recognize: a visitor signs up, an
 * account whose session expired signs in. Both come back and the room is created.
 */
export function createRoomEntryHref(hadAccount: boolean): string {
  const back = encodeURIComponent(CREATE_ROOM_RETURN);
  if (hadAccount) return `/entrar?voltar=${back}`;
  return `/cadastro?voltar=${back}`;
}

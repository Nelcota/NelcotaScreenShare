/** The sign-in page's notice for a session ended in another browser. */
export const SESSION_ENDED_NOTICE = "encerrada";

/** Sign in again, then back to the page the person was on. */
export function sessionEndedHref(currentPath: string): string {
  const params = new URLSearchParams({ aviso: SESSION_ENDED_NOTICE, voltar: currentPath });
  return `/entrar?${params.toString()}`;
}

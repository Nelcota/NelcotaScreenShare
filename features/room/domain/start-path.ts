/** Where "back to the start" leads: the app's start when signed in, the home page for a guest. */
export function startPath(signedIn: boolean): string {
  return signedIn ? "/inicio" : "/";
}

/**
 * A full page load the app starts on purpose (the session ended elsewhere) must not ask
 * "Sair do site?": the page that warns before leaving lets it through.
 */
let leavingAllowed = false;

export function allowLeavingPage(): void {
  leavingAllowed = true;
}

export function isLeavingPageAllowed(): boolean {
  return leavingAllowed;
}

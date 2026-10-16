/** Whether the page being opened belongs to this tab: its own path or one below it. */
export function opensTab(nextPath: string | undefined, tabHref: string): boolean {
  if (!nextPath) return false;
  return nextPath === tabHref || nextPath.startsWith(`${tabHref}/`);
}

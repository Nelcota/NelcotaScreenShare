/**
 * Lets the browser save a file from a short signed link. The storage always sends it as an
 * attachment, so the page stays where it is.
 */
export function saveFromLink(url: string): void {
  const link = document.createElement("a");
  link.href = url;
  link.rel = "noopener";
  link.click();
}

import { badgeLabel } from "@/features/notifications/domain/unread";
import { logBrowserWarning } from "@/lib/telemetry.client";

const SIZE = 64;
// Keep URLs outside the DOM so another attribute cannot replace the saved value.
const originalIcons = new Map<HTMLLinkElement, string>();

let icon: Promise<HTMLImageElement> | undefined;
/** The latest call wins: an icon still loading never overwrites a newer count. */
let latest = 0;

function iconLinks(): HTMLLinkElement[] {
  return [...document.querySelectorAll<HTMLLinkElement>('link[rel="icon"]')];
}

function loadIcon(): Promise<HTMLImageElement> {
  icon ??= new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener("load", () => resolve(image), { once: true });
    image.addEventListener("error", () => reject(new Error("Tab icon did not load")), {
      once: true,
    });
    image.src = "/icon.png";
  });
  return icon;
}

function drawBadge(image: HTMLImageElement, count: number): string | undefined {
  const canvas = document.createElement("canvas");
  canvas.width = SIZE;
  canvas.height = SIZE;
  const context = canvas.getContext("2d");
  if (!context) return undefined;
  context.drawImage(image, 0, 0, SIZE, SIZE);
  const radius = 19;
  const center = SIZE - radius;
  context.fillStyle = "#dc2626";
  context.beginPath();
  context.arc(center, center, radius, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = "#ffffff";
  context.font = "bold 26px sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(badgeLabel(count), center, center + 1);
  return canvas.toDataURL("image/png");
}

function restoreIcons() {
  for (const [link, href] of originalIcons) {
    const original = new URL(href);
    if (original.protocol !== "http:" && original.protocol !== "https:") continue;
    link.href = original.href;
  }
  originalIcons.clear();
}

/** A red dot with the count on the tab icon; zero puts the original icon back. */
export async function setFaviconBadge(count: number): Promise<void> {
  latest += 1;
  const call = latest;
  if (count <= 0) {
    restoreIcons();
    return;
  }
  try {
    const image = await loadIcon();
    if (call !== latest) return;
    const badge = drawBadge(image, count);
    if (!badge) return;
    for (const link of iconLinks()) {
      if (!originalIcons.has(link)) originalIcons.set(link, link.href);
      link.href = badge;
    }
  } catch (error) {
    logBrowserWarning("Could not draw the unread badge on the tab icon", error);
  }
}

/**
 * The status each person picks, Skype style. It applies on every device. Invisible is
 * shown to friends as Offline; Offline itself is never picked, it only means nobody is
 * connected.
 */
export const PRESENCE_STATUSES = ["online", "away", "busy", "invisible"] as const;
export type PresenceStatus = (typeof PRESENCE_STATUSES)[number];

/** What friends see: the chosen status while connected, otherwise Offline. */
export type ShownStatus = "online" | "away" | "busy" | "offline";

export const DEFAULT_STATUS: PresenceStatus = "online";

export function shownStatus(chosen: PresenceStatus, connected: boolean): ShownStatus {
  if (!connected || chosen === "invisible") return "offline";
  return chosen;
}

/** Whether a call reaches the person: Ausente still rings; Não perturbe and Offline do not. */
export function canBeCalled(status: ShownStatus): boolean {
  return status === "online" || status === "away";
}

export const SHOWN_STATUS_LABEL: Record<ShownStatus, string> = {
  online: "Online",
  away: "Ausente",
  busy: "Não perturbe",
  offline: "Offline",
};

/** The menu where people pick their own status. */
export const STATUS_CHOICES: { status: PresenceStatus; label: string; hint?: string }[] = [
  { status: "online", label: "Online" },
  { status: "away", label: "Ausente", hint: "Fora do PC" },
  { status: "busy", label: "Não perturbe", hint: "Ninguém consegue te chamar" },
  { status: "invisible", label: "Invisível", hint: "Aparece offline para os amigos" },
];

/** How your own status reads in the column's foot. */
export const OWN_STATUS_LABEL: Record<PresenceStatus, string> = {
  online: "Online",
  away: "Ausente",
  busy: "Não perturbe",
  invisible: "Invisível",
};

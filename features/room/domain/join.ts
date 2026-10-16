import type { TokenErrorCode } from "./token-contract";

/** What the pre-join screen hands to the room. */
export interface JoinChoices {
  /** In memory only: the room's "Tentar de novo" requests a new token with it. */
  password?: string;
  /** A guest's name, for the same retry. */
  guestName?: string;
  token: string;
  serverUrl: string;
  sessionId?: string;
  micEnabled: boolean;
  audioDeviceId?: string;
}

/** What to do when the token request fails in the pre-join screen. */
export interface JoinFailure {
  /** Session expired or email not verified: go to the right screen and come back later. */
  redirect?: "login" | "verify-email";
  /** Banned, or the room is gone: the room page loads again and shows why, without the form. */
  reloadRoom?: boolean;
  /** Error marked on the password field (and focus on it). */
  passwordField: boolean;
  /** An attempt error (password, data) makes it grumpy; a server or network failure, worried. */
  mood: "grumpy" | "worried";
}

export function joinFailure(code: TokenErrorCode | "network_error"): JoinFailure {
  if (code === "unauthenticated") {
    return { redirect: "login", passwordField: false, mood: "worried" };
  }
  if (code === "email_unverified") {
    return { redirect: "verify-email", passwordField: false, mood: "worried" };
  }
  if (code === "banned" || code === "room_not_found") {
    return { reloadRoom: true, passwordField: false, mood: "worried" };
  }
  if (code === "invalid_password") return { passwordField: true, mood: "grumpy" };
  if (code === "invalid_request") return { passwordField: false, mood: "grumpy" };
  return { passwordField: false, mood: "worried" };
}

/** "Who is already inside": answers "am I in the right place? has it started?". */
export type Presence =
  | { kind: "full"; text: string }
  | { kind: "empty"; text: string }
  | { kind: "some"; text: string };

export function presenceText(online: number, max: number, guest = false): Presence {
  if (online >= max) {
    return {
      kind: "full",
      text: `A sala está cheia (${online} de ${max} pessoas). Aguarde alguém sair.`,
    };
  }
  // A guest only gets in after someone with an account opens the room.
  if (online === 0 && guest) {
    return {
      kind: "empty",
      text: "A sala ainda não abriu. Se te convidaram, você entra assim que a pessoa chegar.",
    };
  }
  if (online === 0) {
    return { kind: "empty", text: "Ninguém na sala ainda." };
  }
  return {
    kind: "some",
    text: online === 1 ? "1 pessoa já está na sala" : `${online} pessoas já estão na sala`,
  };
}

/**
 * Shown for a few seconds after joining straight from "Chamar" or a ring, without the
 * pre-join: the microphone came in as saved, and this is how to switch it.
 */
export function directEntryNotice(micOn: boolean, key: string): string {
  if (micOn) return `Microfone ligado · ${key} para desligar`;
  return `Microfone desligado · ${key} para ligar`;
}

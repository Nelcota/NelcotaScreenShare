import { decodeRoomParam, roomCodeSchema } from "./room-code";
import type { LeaveNotice } from "./leave";

const ROOM_PATH = /^\/sala\/([^/]+)\/?$/;

/** Room code a path opens (normalized like the room page does), or `undefined` for other pages. */
export function roomCodeFromPath(pathname: string): string | undefined {
  const segment = ROOM_PATH.exec(pathname)?.[1];
  if (segment === undefined) return undefined;
  const raw = decodeRoomParam(segment);
  if (raw === undefined) return undefined;
  const code = roomCodeSchema.safeParse(raw);
  if (!code.success) return undefined;
  return code.data;
}

/**
 * Whether going to `nextPathname` would drop the call in `activeCode`: only another room does.
 * The same room (with or without an invite) and any other page keep the call going.
 */
export function shouldConfirmRoomSwitch(
  activeCode: string | undefined,
  nextPathname: string,
): boolean {
  if (activeCode === undefined) return false;
  const nextCode = roomCodeFromPath(nextPathname);
  if (nextCode === undefined) return false;
  return nextCode !== activeCode;
}

/** Room codes stay off the screen in streamer mode. */
interface SwitchCopyOptions {
  hideCodes: boolean;
}

/** Body of the confirmation before leaving one room for another in the same tab. */
export function roomSwitchMessage(
  from: string,
  to: string | undefined,
  { hideCodes }: SwitchCopyOptions,
): string {
  if (hideCodes || to === undefined) return "Você vai sair da sala atual e entrar em outra.";
  return `Você vai sair da sala ${from} e entrar na sala ${to}.`;
}

/** Body of the confirmation before joining here while another tab is in a call. */
export function otherTabCallMessage(code: string, { hideCodes }: SwitchCopyOptions): string {
  if (hideCodes) return "Você já está em uma sala em outra aba. Ao entrar aqui, você sai de lá.";
  return `Você já está na sala ${code} em outra aba. Ao entrar aqui, você sai de lá.`;
}

/** How a call ends when this browser joins a call in another tab. */
export const OTHER_TAB_TOOK_OVER: LeaveNotice = {
  reason: "elsewhere",
  message: "Você entrou numa sala em outra aba.",
};

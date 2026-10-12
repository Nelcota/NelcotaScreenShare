import { WebSocket } from "ws";
import { tokenResponseSchema } from "@/features/room/domain/token-contract";
import { joinRoom, type Participant } from "./session";
import { E2E_URL } from "./env";

/** Chromium accepts Secure localhost cookies over HTTP; Node API requests need explicit cookies. */
export async function accountHeaders(person: Participant) {
  return {
    origin: E2E_URL,
    cookie: (await person.context.cookies())
      .map((cookie) => `${cookie.name}=${cookie.value}`)
      .join("; "),
  };
}

export async function joinControlled(person: Participant, code: string) {
  const response = person.page.waitForResponse(
    (result) =>
      new URL(result.url()).pathname === "/api/token" && result.request().method() === "POST",
  );
  await joinRoom(person.page, code);
  return tokenResponseSchema.parse(await (await response).json());
}

/** Record JWT refresh frames without logging bearer credentials. */
export function refreshedCredentials(person: Participant) {
  const tokens: string[] = [];
  person.page.on("websocket", (socket) => {
    if (!socket.url().includes("/api/sala/conexao/rtc")) return;
    socket.on("framereceived", (frame) => {
      const token = frame.payload.toString().match(/eyJ[\w-]+\.eyJ[\w-]+\.[\w-]+/);
      if (token?.[0]) tokens.push(token[0]);
    });
  });
  return tokens;
}

/** The server must refuse the HTTP upgrade before LiveKit can admit the identity. */
export async function signalStatus(serverUrl: string, token: string) {
  const url = new URL(`${serverUrl}/rtc`);
  url.searchParams.set("access_token", token);
  url.searchParams.set("protocol", "16");
  return new Promise<number>((resolve) => {
    const socket = new WebSocket(url, { handshakeTimeout: 5_000 });
    socket.on("error", () => resolve(0));
    socket.once("open", () => {
      socket.close();
      resolve(101);
    });
    socket.once("unexpected-response", (_request, response) => {
      response.resume();
      socket.terminate();
      resolve(response.statusCode ?? 0);
    });
  });
}

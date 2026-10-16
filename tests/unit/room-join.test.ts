import { ConnectionError, DisconnectReason } from "livekit-client";
import { describe, expect, it } from "vitest";
import { connectErrorMessage, disconnectMessage } from "@/features/room/client/connection-errors";
import { pickFocusedShare, sortByOrder, trackShareOrder } from "@/features/room/domain/focus";
import { GUEST_WAIT_TEXT, joinFailure, presenceText } from "@/features/room/domain/join";
import { presenceForGuests } from "@/features/room/domain/presence";

const share = (sid: string, isLocal = false) => ({
  publication: { trackSid: sid },
  participant: { isLocal },
});

describe("screen on stage", () => {
  it("the chosen one; else the most recent from others; own share only when alone", () => {
    const mine = share("TR_eu", true);
    const ana = share("TR_ana");
    const bia = share("TR_bia");
    expect(pickFocusedShare([ana, bia, mine], "TR_ana")).toBe(ana);
    expect(pickFocusedShare([ana, bia, mine], undefined)).toBe(bia);
    expect(pickFocusedShare([ana, bia], "TR_sumiu")).toBe(bia);
    expect(pickFocusedShare([mine], undefined)).toBe(mine);
    expect(pickFocusedShare([], undefined)).toBeUndefined();
  });

  it("remembers the order screens appeared, not the participant order", () => {
    const ana = share("TR_ana");
    const bia = share("TR_bia");
    // Bia shared first; Ana, who joined earlier, shares later: Ana is the most recent.
    const first = trackShareOrder([], [bia]);
    const second = trackShareOrder(first.order, [ana, bia]);
    expect(second.order).toEqual(["TR_bia", "TR_ana"]);
    expect(pickFocusedShare(sortByOrder([ana, bia], second.order), undefined)).toBe(ana);
    expect(trackShareOrder(second.order, [ana]).order).toEqual(["TR_ana"]);
  });

  it("a new screen from someone else takes the stage; your own does not", () => {
    const ana = share("TR_ana");
    const mine = share("TR_eu", true);
    expect(trackShareOrder([], [ana]).takesStage).toBe(true);
    expect(trackShareOrder(["TR_ana"], [ana, mine]).takesStage).toBe(false);
    expect(trackShareOrder(["TR_ana"], [ana]).takesStage).toBe(false);
  });
});

describe("token request failure in the pre-join screen", () => {
  it("session or e-mail: leaves to the right screen", () => {
    expect(joinFailure("unauthenticated").redirect).toBe("login");
    expect(joinFailure("email_unverified").redirect).toBe("verify-email");
  });

  it("banned or a room that is gone: the room page loads again instead of showing an error", () => {
    expect(joinFailure("banned").reloadRoom).toBe(true);
    expect(joinFailure("room_not_found").reloadRoom).toBe(true);
    expect(joinFailure("room_full").reloadRoom).toBeUndefined();
  });

  it("user error makes it grumpy; server or network error, worried", () => {
    expect(joinFailure("invalid_password")).toEqual({ passwordField: true, mood: "grumpy" });
    expect(joinFailure("invalid_request")).toEqual({ passwordField: false, mood: "grumpy" });
    expect(joinFailure("room_full").mood).toBe("worried");
    expect(joinFailure("network_error").mood).toBe("worried");
  });
});

describe("who is already in the room", () => {
  it("empty, with people and full", () => {
    expect(presenceText(0, 6).kind).toBe("empty");
    expect(presenceText(0, 6, true).text).toBe(GUEST_WAIT_TEXT);
    expect(joinFailure("host_absent")).toMatchObject({ waiting: true, passwordField: false });
    expect(presenceText(1, 6).text).toBe("1 pessoa já está na sala");
    expect(presenceText(3, 6).text).toBe("3 pessoas já estão na sala");
    expect(presenceText(6, 6)).toEqual({
      kind: "full",
      text: "A sala está cheia (6 de 6 pessoas). Aguarde alguém sair.",
    });
  });
});

describe("LiveKit error messages", () => {
  it("connect failure: room full, permission, network and timeout", () => {
    expect(connectErrorMessage(ConnectionError.internal("room is full"))).toContain("cheia");
    expect(connectErrorMessage(ConnectionError.notAllowed("x", 403))).toContain("renovar o acesso");
    expect(connectErrorMessage(ConnectionError.serverUnreachable("x"))).toContain(
      "Verifique sua internet",
    );
    expect(connectErrorMessage(ConnectionError.timeout("x"))).toContain("outra rede");
    expect(connectErrorMessage(new Error("anything"))).toContain("Aguarde alguns segundos");
  });

  it("disconnect: other tab, removed, room ended; own leave without message", () => {
    expect(disconnectMessage(DisconnectReason.DUPLICATE_IDENTITY)).toContain("outra aba");
    expect(disconnectMessage(DisconnectReason.PARTICIPANT_REMOVED)).toContain(
      "tirou você da chamada",
    );
    expect(disconnectMessage(DisconnectReason.ROOM_DELETED)).toContain("encerrada");
    expect(disconnectMessage(DisconnectReason.CLIENT_INITIATED)).toBeUndefined();
  });
});

describe("presence for guests", () => {
  const presence = {
    online: 2,
    participants: [
      { id: "1", name: "Ana Souza", image: "data:image/webp;base64,UklGR" },
      { id: "2", name: "Bia Lima", image: null },
    ],
  };

  it("without the access password, shows who is inside", () => {
    expect(presenceForGuests(presence, false)).toBe(presence);
  });

  it("with the access password, keeps only the count", () => {
    expect(presenceForGuests(presence, true)).toEqual({ online: 2, participants: [] });
  });
});

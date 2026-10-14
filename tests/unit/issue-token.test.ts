import { describe, expect, it, vi } from "vitest";
import {
  decideTokenRequest,
  type TokenAccount,
  type TokenDeps,
  type TokenPolicy,
} from "@/features/room/domain/issue-token";

const ANA: TokenAccount = { id: "ana", name: "Ana", blocked: false, emailVerified: true };
const OPEN: TokenPolicy = {
  requireVerifiedEmail: false,
  accessPassword: undefined,
  maxParticipants: 3,
};
const ok = { ok: true, retryAfterSeconds: 0 };

function deps(overrides: Partial<TokenDeps> = {}): TokenDeps {
  return {
    hitAccountLimit: () => ok,
    passwordFailures: { peek: () => ok, fail: vi.fn(), reset: vi.fn() },
    passwordMatches: (given) => given === "certa",
    countParticipants: () => Promise.resolve(0),
    redeemInvite: () => Promise.resolve(true),
    hostPresent: () => Promise.resolve(true),
    roomExists: () => Promise.resolve(true),
    roleOf: () => Promise.resolve("participant"),
    bannedFromCall: () => Promise.resolve(false),
    accessOf: () => Promise.resolve("open"),
    guestBannedFromCall: () => Promise.resolve(false),
    awaitApproval: () => Promise.resolve({ approved: false, requestId: "pedido-1" }),
    ...overrides,
  };
}

const body = (value: unknown) => ({ readable: true as const, value });
const messageOf = (decision: Awaited<ReturnType<typeof decideTokenRequest>>) =>
  decision.ok ? "" : decision.message;

describe("who joins the room", () => {
  it("passes the caller's identity to capacity checks so replacing a connection can join", async () => {
    const countParticipants = vi.fn(
      async (_room: string, identity: string) =>
        ["ana", "bia", "caio"].filter((member) => member !== identity).length,
    );
    const decision = await decideTokenRequest(
      ANA,
      body({ room: "sala" }),
      OPEN,
      deps({ countParticipants }),
    );
    expect(decision.ok).toBe(true);
    expect(countParticipants).toHaveBeenCalledWith("sala", ANA.id);
    expect(
      await decideTokenRequest(
        { ...ANA, id: "nova" },
        body({ room: "sala" }),
        OPEN,
        deps({ countParticipants }),
      ),
    ).toMatchObject({ error: "room_full" });
  });
  it("signed-in account and room with space: joins with the account's identity and name", async () => {
    const decision = await decideTokenRequest(ANA, body({ room: "Sala-Teste" }), OPEN, deps());
    expect(decision).toEqual({
      ok: true,
      log: "granted",
      grant: { identity: "ana", name: "Ana", room: "sala-teste", role: "participant" },
    });
  });

  it("no account, blocked, or unverified e-mail (when required)", async () => {
    expect(await decideTokenRequest(null, body({ room: "sala" }), OPEN, deps())).toMatchObject({
      error: "unauthenticated",
      log: "unauthenticated",
    });
    const blocked = { ...ANA, blocked: true };
    expect(await decideTokenRequest(blocked, body({ room: "sala" }), OPEN, deps())).toMatchObject({
      error: "blocked",
    });
    const unverified = { ...ANA, emailVerified: false };
    expect(
      await decideTokenRequest(unverified, body({ room: "sala" }), OPEN, deps()),
    ).toMatchObject({ ok: true });
    expect(
      await decideTokenRequest(
        unverified,
        body({ room: "sala" }),
        { ...OPEN, requireVerifiedEmail: true },
        deps(),
      ),
    ).toMatchObject({ error: "email_unverified", log: "unverified" });
  });

  it("the per-account limit applies before looking at the request", async () => {
    const decision = await decideTokenRequest(
      ANA,
      { readable: false },
      OPEN,
      deps({ hitAccountLimit: () => ({ ok: false, retryAfterSeconds: 42 }) }),
    );
    expect(decision).toMatchObject({ error: "rate_limited", retryAfterSeconds: 42 });
  });

  it("an unreadable or invalid request says which field to check", async () => {
    const unreadable = await decideTokenRequest(ANA, { readable: false }, OPEN, deps());
    expect(unreadable).toMatchObject({ error: "invalid_request", log: "invalid" });
    expect(messageOf(unreadable)).toContain("ler os dados");
    expect(messageOf(await decideTokenRequest(ANA, body({ room: "!!" }), OPEN, deps()))).toContain(
      "código da sala",
    );
    const longPassword = body({ room: "sala", password: "x".repeat(200) });
    expect(messageOf(await decideTokenRequest(ANA, longPassword, OPEN, deps()))).toContain(
      "no máximo 128",
    );
  });

  it("access password: wrong counts a failure, right resets, an invite skips it", async () => {
    const policy = { ...OPEN, accessPassword: "certa" };
    const failures = { peek: () => ok, fail: vi.fn(), reset: vi.fn() };
    const wrong = await decideTokenRequest(
      ANA,
      body({ room: "sala", password: "errada" }),
      policy,
      deps({ passwordFailures: failures }),
    );
    expect(wrong).toMatchObject({ error: "invalid_password", log: "wrong_password" });
    expect(failures.fail).toHaveBeenCalledOnce();

    const right = await decideTokenRequest(
      ANA,
      body({ room: "sala", password: "certa" }),
      policy,
      deps({ passwordFailures: failures }),
    );
    expect(right.ok).toBe(true);
    expect(failures.reset).toHaveBeenCalledOnce();

    const withInvite = await decideTokenRequest(
      ANA,
      body({ room: "sala", invite: "convite" }),
      policy,
      deps(),
    );
    expect(withInvite.ok).toBe(true);
  });

  it("too many wrong passwords: must wait, even when getting it right", async () => {
    const decision = await decideTokenRequest(
      ANA,
      body({ room: "sala", password: "certa" }),
      { ...OPEN, accessPassword: "certa" },
      deps({
        passwordFailures: {
          peek: () => ({ ok: false, retryAfterSeconds: 900 }),
          fail: vi.fn(),
          reset: vi.fn(),
        },
      }),
    );
    expect(decision).toMatchObject({ error: "rate_limited", retryAfterSeconds: 900 });
  });

  it("a full room does not use up the invite; an invalid invite is rejected", async () => {
    const redeemInvite = vi.fn(() => Promise.resolve(true));
    const full = await decideTokenRequest(
      ANA,
      body({ room: "sala", invite: "convite" }),
      OPEN,
      deps({ countParticipants: () => Promise.resolve(3), redeemInvite }),
    );
    expect(full).toMatchObject({ error: "room_full" });
    expect(messageOf(full)).toContain("3 pessoas");
    expect(redeemInvite).not.toHaveBeenCalled();

    const invalid = await decideTokenRequest(
      ANA,
      body({ room: "sala", invite: "vencido" }),
      OPEN,
      deps({ redeemInvite: () => Promise.resolve(false) }),
    );
    expect(invalid).toMatchObject({ error: "invite_invalid", log: "invite_invalid" });
  });

  it('a LiveKit failure propagates to the caller (it becomes "room unavailable")', async () => {
    await expect(
      decideTokenRequest(
        ANA,
        body({ room: "sala" }),
        OPEN,
        deps({ countParticipants: () => Promise.reject(new Error("LiveKit fora")) }),
      ),
    ).rejects.toThrow("LiveKit fora");
  });
});

describe("guests (no account)", () => {
  const GUEST = { guestId: "4d1f0a3e-8a5b-4c39-9f0e-2b7c1d6e9a10" };

  it("excludes the same guest's signed identity when returning to a full room", async () => {
    const identity = `convidado-${GUEST.guestId}`;
    const countParticipants = vi.fn(
      async (_room: string, caller: string) =>
        ["ana", "bia", identity].filter((member) => member !== caller).length,
    );
    const decision = await decideTokenRequest(
      GUEST,
      body({ room: "sala", guestName: "Visita" }),
      OPEN,
      deps({ countParticipants }),
    );
    expect(decision).toMatchObject({ ok: true, grant: { identity } });
    expect(countParticipants).toHaveBeenCalledWith("sala", identity);
  });

  it("joins a room with a host, under a marked identity and the chosen name", async () => {
    const decision = await decideTokenRequest(
      GUEST,
      body({ room: "sala", guestName: "  Bia  " }),
      OPEN,
      deps(),
    );
    expect(decision).toEqual({
      ok: true,
      log: "granted",
      grant: {
        identity: `convidado-${GUEST.guestId}`,
        name: "Bia",
        room: "sala",
        role: "participant",
      },
    });
  });

  it("needs a name, and an invite from the panel needs an account", async () => {
    expect(await decideTokenRequest(GUEST, body({ room: "sala" }), OPEN, deps())).toMatchObject({
      error: "invalid_request",
    });
    expect(
      await decideTokenRequest(
        GUEST,
        body({ room: "sala", guestName: "Bia", invite: "abc" }),
        OPEN,
        deps(),
      ),
    ).toMatchObject({ error: "invite_invalid", log: "invite_invalid" });
  });

  it("waits for a host and respects the password and the room size", async () => {
    const request = body({ room: "sala", guestName: "Bia" });
    expect(
      await decideTokenRequest(
        GUEST,
        request,
        OPEN,
        deps({ hostPresent: () => Promise.resolve(false) }),
      ),
    ).toMatchObject({ error: "host_absent", log: "host_absent" });
    expect(
      await decideTokenRequest(GUEST, request, { ...OPEN, accessPassword: "certa" }, deps()),
    ).toMatchObject({ error: "invalid_password" });
    expect(
      await decideTokenRequest(
        GUEST,
        request,
        OPEN,
        deps({ countParticipants: () => Promise.resolve(3) }),
      ),
    ).toMatchObject({ error: "room_full" });
  });

  it("the attempt limit counts per guest", async () => {
    const hitAccountLimit = vi.fn(() => ({ ok: false, retryAfterSeconds: 9 }));
    const decision = await decideTokenRequest(
      GUEST,
      body({ room: "sala", guestName: "Bia" }),
      OPEN,
      deps({ hitAccountLimit }),
    );
    expect(decision).toMatchObject({ error: "rate_limited", retryAfterSeconds: 9 });
    expect(hitAccountLimit).toHaveBeenCalledWith(`convidado-${GUEST.guestId}`);
  });
});

describe("role in the room", () => {
  it("the account gets its saved role in that room", async () => {
    const roleOf = vi.fn(() => Promise.resolve("owner" as const));
    const decision = await decideTokenRequest(
      ANA,
      body({ room: "Sala-Teste" }),
      OPEN,
      deps({ roleOf }),
    );
    expect(decision).toMatchObject({ ok: true, grant: { role: "owner" } });
    expect(roleOf).toHaveBeenCalledWith("sala-teste", "ana");
  });

  it("guests are participants", async () => {
    const roleOf = vi.fn(() => Promise.resolve("owner" as const));
    const decision = await decideTokenRequest(
      { guestId: "4d1f0a3e-8a5b-4c39-9f0e-2b7c1d6e9a10" },
      body({ room: "sala", guestName: "Bia" }),
      OPEN,
      deps({ roleOf }),
    );
    expect(decision).toMatchObject({ ok: true, grant: { role: "participant" } });
    expect(roleOf).not.toHaveBeenCalled();
  });
});

describe("rooms nobody created", () => {
  it("an account is refused before the password and the invite", async () => {
    const passwordMatches = vi.fn(() => true);
    const redeemInvite = vi.fn(() => Promise.resolve(true));
    const decision = await decideTokenRequest(
      ANA,
      body({ room: "bzk-i123-askjndjkaw", password: "certa" }),
      { ...OPEN, accessPassword: "certa" },
      deps({ roomExists: () => Promise.resolve(false), passwordMatches, redeemInvite }),
    );
    expect(decision).toMatchObject({ ok: false, error: "room_not_found", log: "room_not_found" });
    expect(messageOf(decision)).toBe("Esta sala não existe. Confira o link.");
    expect(passwordMatches).not.toHaveBeenCalled();
    expect(redeemInvite).not.toHaveBeenCalled();
  });

  it("a guest is refused too", async () => {
    const decision = await decideTokenRequest(
      { guestId: "4d1f0a3e-8a5b-4c39-9f0e-2b7c1d6e9a10" },
      body({ room: "sala", guestName: "Bia" }),
      OPEN,
      deps({ roomExists: () => Promise.resolve(false) }),
    );
    expect(decision).toMatchObject({ ok: false, error: "room_not_found" });
  });
});

describe("banned from the call", () => {
  it("refuses a banned account before the password", async () => {
    const bannedFromCall = vi.fn(() => Promise.resolve(true));
    const passwordMatches = vi.fn(() => true);
    const decision = await decideTokenRequest(
      ANA,
      body({ room: "Sala", password: "certa" }),
      { ...OPEN, accessPassword: "certa" },
      deps({ bannedFromCall, passwordMatches }),
    );
    expect(decision).toMatchObject({ ok: false, error: "banned", log: "banned" });
    expect(bannedFromCall).toHaveBeenCalledWith("sala", "ana");
    expect(passwordMatches).not.toHaveBeenCalled();
  });

  it("refuses a banned guest by the guest identity", async () => {
    const bannedFromCall = vi.fn(() => Promise.resolve(true));
    const guestId = "4d1f0a3e-8a5b-4c39-9f0e-2b7c1d6e9a10";
    const decision = await decideTokenRequest(
      { guestId },
      body({ room: "sala", guestName: "Bia" }),
      OPEN,
      deps({ bannedFromCall }),
    );
    expect(decision).toMatchObject({ ok: false, error: "banned" });
    expect(bannedFromCall).toHaveBeenCalledWith("sala", `convidado-${guestId}`);
  });
});

describe("rooms with approval", () => {
  const approval = { accessOf: () => Promise.resolve("approval" as const) };

  it("the owner and moderators go straight in", async () => {
    const awaitApproval = vi.fn();
    for (const role of ["owner", "moderator"] as const) {
      const decision = await decideTokenRequest(
        ANA,
        body({ room: "sala" }),
        OPEN,
        deps({ ...approval, awaitApproval, roleOf: () => Promise.resolve(role) }),
      );
      expect(decision.ok).toBe(true);
    }
    expect(awaitApproval).not.toHaveBeenCalled();
  });

  it("a participant waits with a request to follow, and an accepted one gets in", async () => {
    const waiting = await decideTokenRequest(ANA, body({ room: "sala" }), OPEN, deps(approval));
    expect(waiting).toMatchObject({
      ok: false,
      error: "awaiting_approval",
      log: "awaiting_approval",
      requestId: "pedido-1",
    });

    const awaitApproval = vi.fn(() => Promise.resolve({ approved: true as const }));
    const requestId = "0199c6f0-0000-7000-8000-0000000000aa";
    const admitted = await decideTokenRequest(
      ANA,
      body({ room: "sala", requestId }),
      OPEN,
      deps({ ...approval, awaitApproval }),
    );
    expect(admitted.ok).toBe(true);
    expect(awaitApproval).toHaveBeenCalledWith({
      room: "sala",
      requester: { userId: "ana" },
      name: "Ana",
      requestId,
    });
  });

  it("after a guest ban, new guests of an open room ask first; accounts still go in", async () => {
    const awaitApproval = vi.fn(() =>
      Promise.resolve({ approved: false as const, requestId: "p" }),
    );
    const afterBan = deps({ guestBannedFromCall: () => Promise.resolve(true), awaitApproval });
    const guest = await decideTokenRequest(
      { guestId: "g2" },
      body({ room: "sala", guestName: "Outra visita" }),
      OPEN,
      afterBan,
    );
    expect(guest).toMatchObject({ ok: false, error: "awaiting_approval", requestId: "p" });
    const account = await decideTokenRequest(ANA, body({ room: "sala" }), OPEN, afterBan);
    expect(account.ok).toBe(true);
    const noBan = await decideTokenRequest(
      { guestId: "g3" },
      body({ room: "sala", guestName: "Visita" }),
      OPEN,
      deps({ awaitApproval }),
    );
    expect(noBan.ok).toBe(true);
  });

  it("a guest asks too, after the host check", async () => {
    const awaitApproval = vi.fn(() =>
      Promise.resolve({ approved: false as const, requestId: "p" }),
    );
    const decision = await decideTokenRequest(
      { guestId: "g1" },
      body({ room: "sala", guestName: "Visita" }),
      OPEN,
      deps({ ...approval, awaitApproval }),
    );
    expect(decision).toMatchObject({ ok: false, error: "awaiting_approval", requestId: "p" });
    expect(awaitApproval).toHaveBeenCalledWith(
      expect.objectContaining({ requester: { guestId: "g1" }, name: "Visita" }),
    );
  });

  it("an open room never asks", async () => {
    const awaitApproval = vi.fn();
    const decision = await decideTokenRequest(
      ANA,
      body({ room: "sala" }),
      OPEN,
      deps({ awaitApproval }),
    );
    expect(decision.ok).toBe(true);
    expect(awaitApproval).not.toHaveBeenCalled();
  });
});

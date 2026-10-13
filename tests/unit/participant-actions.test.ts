import { describe, expect, it } from "vitest";
import {
  availableActions,
  type ParticipantState,
} from "@/features/admin/participants/domain/available-actions";

const ALL = { update: true, delete: true, anonymize: true, disableTwoFactor: true };
const base: ParticipantState = {
  status: "ativo",
  verified: true,
  anonymized: false,
  twoFactor: false,
  photo: false,
  sessions: 0,
  can: ALL,
};

describe("participant detail actions", () => {
  it("active: block, delete and anonymize", () => {
    expect(availableActions(base)).toEqual({
      unblock: false,
      block: true,
      revokeSessions: false,
      resendVerification: false,
      restore: false,
      delete: true,
      anonymize: true,
      disableTwoFactor: false,
      removePhoto: false,
      resetName: true,
    });
  });

  it("photo and name: for a live account, with update permission", () => {
    expect(availableActions({ ...base, photo: true }).removePhoto).toBe(true);
    expect(availableActions({ ...base, photo: true, status: "excluido" })).toMatchObject({
      removePhoto: false,
      resetName: false,
    });
    expect(availableActions({ ...base, anonymized: true }).resetName).toBe(false);
  });

  it("blocked with sessions and unverified e-mail", () => {
    const actions = availableActions({
      ...base,
      status: "bloqueado",
      sessions: 2,
      verified: false,
    });
    expect(actions).toMatchObject({
      unblock: true,
      block: false,
      revokeSessions: true,
      resendVerification: true,
    });
  });

  it("deleted: only restore (if not anonymized) and anonymize", () => {
    expect(availableActions({ ...base, status: "excluido" })).toMatchObject({
      block: false,
      delete: false,
      restore: true,
      anonymize: true,
    });
    expect(availableActions({ ...base, status: "excluido", anonymized: true })).toMatchObject({
      restore: false,
      anonymize: false,
    });
  });

  it("turning off 2FA: owner only, for a live account that uses it", () => {
    expect(availableActions({ ...base, twoFactor: true }).disableTwoFactor).toBe(true);
    const admin = { ...ALL, disableTwoFactor: false };
    expect(availableActions({ ...base, twoFactor: true, can: admin }).disableTwoFactor).toBe(false);
    expect(
      availableActions({ ...base, twoFactor: true, status: "excluido" }).disableTwoFactor,
    ).toBe(false);
  });

  it("reader (no permission) sees no action", () => {
    const none = availableActions({
      ...base,
      can: { update: false, delete: false, anonymize: false, disableTwoFactor: false },
    });
    expect(Object.values(none).some(Boolean)).toBe(false);
  });
});

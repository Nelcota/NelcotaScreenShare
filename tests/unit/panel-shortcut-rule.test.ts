import { beforeEach, expect, test, vi } from "vitest";

const deps = vi.hoisted(() => ({ adminSession: vi.fn(), panelMember: vi.fn() }));

vi.mock("@/features/auth/server/admin-session.server", () => ({
  getAdminSession: deps.adminSession,
}));
vi.mock("@/features/auth/server/panel-member.server", () => ({
  isPanelMember: deps.panelMember,
}));

const { offersPanelShortcut } = await import("../../features/auth/server/panel-shortcut.server");

const ACCOUNT = { email: "ana@exemplo.dev", emailVerified: true };

beforeEach(() => {
  deps.adminSession.mockResolvedValue(null);
  deps.panelMember.mockResolvedValue(false);
});

test("a panel session open in this browser is enough, whatever the app account", async () => {
  deps.adminSession.mockResolvedValue({ user: { id: "admin-1" } });

  await expect(offersPanelShortcut(null)).resolves.toBe(true);
  expect(deps.panelMember).not.toHaveBeenCalled();
});

test("without a panel session, only someone on the team gets it", async () => {
  await expect(offersPanelShortcut(ACCOUNT)).resolves.toBe(false);

  deps.panelMember.mockResolvedValue(true);

  await expect(offersPanelShortcut(ACCOUNT)).resolves.toBe(true);
  expect(deps.panelMember).toHaveBeenLastCalledWith(ACCOUNT);
});

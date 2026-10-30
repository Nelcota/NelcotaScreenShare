import { getAdminSession } from "@/features/auth/server/admin-session.server";
import { isPanelMember, type AppAccountForPanel } from "@/features/auth/server/panel-member.server";

/**
 * Whether the app's top bar offers this person the panel: a panel session open in this
 * browser, or an app account of someone on the team (a verified e-mail of the team). Only a
 * shortcut: the panel still asks for its own sign-in and code.
 */
export async function offersPanelShortcut(
  account: AppAccountForPanel | null | undefined,
): Promise<boolean> {
  if ((await getAdminSession()) !== null) return true;
  return isPanelMember(account);
}

import { routeLoader } from "@/server/route-loader.server";
import { getDb } from "@/server/db/index.server";
import { getEnv } from "@/server/env.server";
import { workspaceUser } from "@/features/rooms/server/workspace-loader.server";
import { entitlement } from "@/features/rooms/server/entitlements.server";
import { myTeams } from "@/features/team/server/queries.server";
import { TeamListPage } from "@/features/team/ui/TeamListPage";
import { skipClientOnlyChanges } from "@/app/revalidation";
export const meta = () => [{ title: "Times · Nelcota" }, { name: "robots", content: "noindex" }];
/** The room filter and ?atendeu are read in the browser: changing them reloads nothing. */
export const shouldRevalidate = skipClientOnlyChanges;

export const loader = routeLoader(async () => {
  const current = await workspaceUser("/times");
  return {
    ...current,
    teams: await myTeams(getDb(), current.actor),
    pro: await entitlement(getDb(), { userId: current.actor }),
    enabled: getEnv().ROOM_HOST_CONTROLS_ENABLED,
  };
});
export default TeamListPage;

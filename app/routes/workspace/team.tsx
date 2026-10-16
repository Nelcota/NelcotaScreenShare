import { routeLoader } from "@/server/route-loader.server";
import { getDb } from "@/server/db/index.server";
import { getEnv } from "@/server/env.server";
import { notFound } from "@/server/http.server";
import { ActionError } from "@/server/operations/action-error";
import { workspaceUser, workspaceId } from "@/features/rooms/server/workspace-loader.server";
import { teamWorkspace } from "@/features/team/server/queries.server";
import { TeamPage } from "@/features/team/ui/TeamPage";
import { skipClientOnlyChanges } from "@/app/revalidation";
export const meta = () => [{ title: "Time · Nelcota" }, { name: "robots", content: "noindex" }];
/** The room filter and ?atendeu are read in the browser: changing them reloads nothing. */
export const shouldRevalidate = skipClientOnlyChanges;

export const loader = routeLoader(async ({ params }) => {
  const teamId = workspaceId(params.id);
  const current = await workspaceUser(`/times/${teamId}`);
  try {
    return {
      ...current,
      ...(await teamWorkspace(getDb(), teamId, current.actor)),
      enabled: getEnv().ROOM_HOST_CONTROLS_ENABLED,
    };
  } catch (error) {
    if (error instanceof ActionError) notFound();
    throw error;
  }
});
export default TeamPage;

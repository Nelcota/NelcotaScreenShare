import { useOperation } from "@/lib/operations/use-operation";
import { WorkspaceShell } from "@/components/workspace/WorkspaceShell";
import { RoomCollection } from "@/components/workspace/RoomCollection";
import { roomWorkspaceAction } from "../actions";
import type { loader } from "@/app/routes/workspace/rooms";
import { useLoaderData } from "react-router";

export function MyRoomsPage() {
  const data = useLoaderData<typeof loader>();
  const mutation = useOperation(roomWorkspaceAction);
  return (
    <WorkspaceShell
      account={data.account}
      title="Minhas salas"
      description="Links permanentes para seus encontros. Favoritos facilitam encontrar salas às quais você já tem acesso."
    >
      <RoomCollection
        rooms={data.rooms}
        pro={data.pro}
        canCreate
        enabled={data.enabled}
        pending={mutation.isPending}
        error={mutation.result.serverError}
        onCommand={mutation.execute}
      />
    </WorkspaceShell>
  );
}

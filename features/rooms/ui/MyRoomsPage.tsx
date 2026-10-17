import { useState } from "react";
import { useOperation } from "@/lib/operations/use-operation";
import { WorkspaceShell } from "@/components/workspace/WorkspaceShell";
import { RoomCollection } from "@/components/workspace/RoomCollection";
import { roomWorkspaceAction } from "../actions";
import { roomAddressProblem, roomFormErrors } from "../client/room-form";
import type { loader } from "@/app/routes/workspace/rooms";
import { useLoaderData } from "react-router";

export function MyRoomsPage() {
  const data = useLoaderData<typeof loader>();
  const [saved, setSaved] = useState(0);
  const mutation = useOperation(roomWorkspaceAction, {
    onSuccess: () => setSaved((count) => count + 1),
  });
  return (
    <WorkspaceShell
      account={data.account}
      title="Minhas salas"
      description="Salas com o mesmo link sempre."
    >
      <RoomCollection
        rooms={data.rooms}
        pro={data.pro}
        canCreate
        enabled={data.enabled}
        pending={mutation.isPending}
        saved={saved}
        {...roomFormErrors(mutation.result)}
        checkAddress={roomAddressProblem}
        onCommand={mutation.execute}
      />
    </WorkspaceShell>
  );
}

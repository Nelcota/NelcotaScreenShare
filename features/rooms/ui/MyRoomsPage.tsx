import { useState } from "react";
import { useOperation } from "@/lib/operations/use-operation";
import { fieldErrorOf } from "@/lib/operations/field-error";
import { WorkspaceShell } from "@/components/workspace/WorkspaceShell";
import { RoomCollection } from "@/components/workspace/RoomCollection";
import { roomWorkspaceAction } from "../actions";
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
        error={mutation.result.serverError}
        saved={saved}
        nameError={fieldErrorOf(mutation.result, "name")}
        onCommand={mutation.execute}
      />
    </WorkspaceShell>
  );
}

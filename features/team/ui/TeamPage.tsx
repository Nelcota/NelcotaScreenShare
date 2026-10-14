import { useId, useState } from "react";
import { useLoaderData, useNavigate } from "react-router";
import { toast } from "sonner";
import { WorkspaceShell } from "@/components/workspace/WorkspaceShell";
import { RoomCollection } from "@/components/workspace/RoomCollection";
import { FormError } from "@/components/FormError";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { formText } from "@/lib/utils";
import { useOperation } from "@/lib/operations/use-operation";
import { fieldErrorOf } from "@/lib/operations/field-error";
import { roomWorkspaceAction } from "@/features/rooms/actions";
import { teamWorkspaceAction } from "../actions";
import { managesTeam } from "../domain/team-policy";
import { TeamMembers } from "./TeamMembers";
import { TeamInvitations } from "./TeamInvitations";
import type { loader } from "@/app/routes/workspace/team";

export function TeamPage() {
  const data = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const id = useId();
  const [deleting, setDeleting] = useState(false);
  const [invitationLink, setInvitationLink] = useState<string>();
  const action = useOperation(teamWorkspaceAction, {
    onSuccess: ({ data: result }) => {
      if (result.invitationLink) setInvitationLink(result.invitationLink);
      if (result.transportPending)
        toast.warning("A alteração foi salva. A desconexão será tentada novamente.");
      if (result.deleted || result.left) void navigate("/times");
    },
  });
  const [savedRooms, setSavedRooms] = useState(0);
  const rooms = useOperation(roomWorkspaceAction, {
    onSuccess: () => setSavedRooms((count) => count + 1),
  });
  const managing = managesTeam(data.role);
  return (
    <WorkspaceShell
      account={data.account}
      title={data.team.name}
      description="Salas, pessoas e chamadas do time, com permissões por função."
    >
      <FormError message={action.result.serverError} />
      <RoomCollection
        rooms={data.rooms}
        teamId={data.team.id}
        pro={data.pro}
        canCreate={managing}
        enabled={data.enabled}
        pending={rooms.isPending}
        error={rooms.result.serverError}
        saved={savedRooms}
        nameError={fieldErrorOf(rooms.result, "name")}
        onCommand={rooms.execute}
      />
      <TeamMembers
        teamId={data.team.id}
        actor={data.actor}
        role={data.role}
        members={data.members}
        pending={action.isPending}
        onCommand={action.execute}
      />
      {managing ? (
        <TeamInvitations
          teamId={data.team.id}
          invitations={data.invitations}
          link={invitationLink}
          active={data.pro.active && data.enabled}
          pending={action.isPending}
          onCommand={action.execute}
        />
      ) : null}
      {managing ? (
        <section className="panel flex max-w-lg flex-col gap-4 rounded-2xl p-5">
          <h2 className="text-xl font-semibold">Configurações do time</h2>
          <form
            className="flex flex-col gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              action.execute({
                kind: "rename",
                teamId: data.team.id,
                name: formText(new FormData(event.currentTarget), "name"),
              });
            }}
          >
            <Label htmlFor={id}>Nome do time</Label>
            <Input
              key={data.team.name}
              id={id}
              name="name"
              defaultValue={data.team.name}
              minLength={2}
              maxLength={80}
              required
            />
            <Button type="submit" disabled={action.isPending}>
              Salvar nome
            </Button>
          </form>
          {data.role === "owner" ? (
            <>
              <p className="text-sm text-ink-muted">
                Para sair do time, transfira a propriedade para outro membro primeiro.
              </p>
              <Button
                variant="destructive"
                disabled={action.isPending}
                onClick={() => setDeleting(true)}
              >
                Excluir time
              </Button>
            </>
          ) : null}
        </section>
      ) : null}
      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        title="Excluir time?"
        description="Todos perderão acesso. As chamadas serão encerradas e as salas arquivadas. Esta exclusão não pode ser desfeita."
        confirmLabel="Excluir time"
        typedConfirmation="EXCLUIR"
        danger
        pending={action.isPending}
        onConfirm={() => {
          action.execute({ kind: "delete", teamId: data.team.id });
          setDeleting(false);
        }}
      />
    </WorkspaceShell>
  );
}

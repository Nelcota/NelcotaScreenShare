import { UsersRound } from "lucide-react";
import { useId, useState } from "react";
import { Link, useLoaderData, useNavigate } from "react-router";
import { ProOnlyNotice } from "@/components/workspace/ProOnlyNotice";
import { WorkspaceShell } from "@/components/workspace/WorkspaceShell";
import { FormError } from "@/components/FormError";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useOperation } from "@/lib/operations/use-operation";
import { formText } from "@/lib/utils";
import { fieldErrorOf } from "@/lib/operations/field-error";
import { workspaceNameSchema } from "@/features/rooms/domain/commands";
import { teamsPageView } from "../domain/teams-page";
import { teamWorkspaceAction } from "../actions";
import type { loader } from "@/app/routes/workspace/teams";

export const roleLabels = { owner: "Dono", manager: "Gestor", member: "Membro" };

type TeamSummary = { id: string; name: string; role: keyof typeof roleLabels };

/** No Pro and no team: what a team is, that it is Pro only, and the way to the Pro list. */
function TeamsWithoutPro() {
  return (
    <ProOnlyNotice
      icon={UsersRound}
      title="Times"
      description="Um time é um grupo fixo de pessoas, com salas que ficam sempre no mesmo link e o histórico das chamadas."
      note="Recebeu um convite? Abra o link que te mandaram."
      className="min-h-[calc(100dvh-12rem)] py-12"
    />
  );
}

function TeamCards({ teams }: { teams: TeamSummary[] }) {
  if (!teams.length) return null;
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {teams.map((team) => (
        <Link
          key={team.id}
          to={`/times/${team.id}`}
          className="panel min-w-0 rounded-2xl p-6 hover:border-brand/50"
        >
          <h2 className="text-xl font-semibold wrap-anywhere">{team.name}</h2>
          <p className="mt-2 text-sm text-ink-muted">{roleLabels[team.role]}</p>
        </Link>
      ))}
    </div>
  );
}

function CreateTeamForm() {
  const id = useId();
  const navigate = useNavigate();
  const action = useOperation(teamWorkspaceAction, {
    onSuccess: ({ data: result }) => void navigate(`/times/${result.teamId}`),
  });
  // Only spaces pass the browser's minLength; the server trims and refuses them too.
  const [nameError, setNameError] = useState<string>();
  const shownError = nameError ?? fieldErrorOf(action.result, "name");
  return (
    <section className="panel flex max-w-lg flex-col gap-4 rounded-2xl p-6">
      <h2 className="text-xl font-semibold">Criar um time</h2>
      <p className="text-sm text-ink-muted">
        Com o Pro beta, você cria até 3 times. A equipe Nelcota libera as salas e os convites de
        cada time novo.
      </p>
      <form
        noValidate
        className="flex flex-col gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          const name = workspaceNameSchema.safeParse(
            formText(new FormData(event.currentTarget), "name"),
          );
          if (!name.success) return setNameError(name.error.issues[0]?.message);
          setNameError(undefined);
          action.execute({ kind: "create", name: name.data });
        }}
      >
        <Label htmlFor={id}>Nome do time</Label>
        <Input
          id={id}
          name="name"
          required
          minLength={2}
          maxLength={80}
          aria-invalid={shownError ? true : undefined}
          aria-describedby={shownError ? `${id}-error` : undefined}
          onChange={() => setNameError(undefined)}
        />
        <FormError id={`${id}-error`} message={shownError} />
        <Button type="submit" disabled={action.isPending}>
          Criar time
        </Button>
        <FormError message={action.result.serverError} />
      </form>
    </section>
  );
}

/** Below the teams: why there is no form, or the form itself. */
function TeamsFooter({
  view,
  hasTeams,
}: {
  view: "pro-off" | "unavailable" | "create";
  hasTeams: boolean;
}) {
  if (view === "pro-off") {
    return <p className="text-sm text-ink-muted">Pro desativado. Seus times continuam aqui.</p>;
  }
  if (view === "unavailable") {
    return <output className="text-sm text-warning">Times ainda não estão disponíveis.</output>;
  }
  return (
    <>
      {hasTeams ? null : <p className="text-ink-muted">Você ainda não faz parte de um time.</p>}
      <CreateTeamForm />
    </>
  );
}

export function TeamListPage() {
  const data = useLoaderData<typeof loader>();
  const view = teamsPageView({
    proActive: data.pro.active,
    enabled: data.enabled,
    teamCount: data.teams.length,
  });
  if (view === "without-pro") {
    return (
      <WorkspaceShell account={data.account} title="Times" description="" bare>
        <TeamsWithoutPro />
      </WorkspaceShell>
    );
  }
  return (
    <WorkspaceShell
      account={data.account}
      title="Seus times"
      description="Reúna as pessoas, mantenha as salas do time e acompanhe o histórico de chamadas."
    >
      <TeamCards teams={data.teams} />
      <TeamsFooter view={view} hasTeams={data.teams.length > 0} />
    </WorkspaceShell>
  );
}

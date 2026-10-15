import { useId, useState } from "react";
import { Link, useLoaderData, useNavigate } from "react-router";
import { WorkspaceShell } from "@/components/workspace/WorkspaceShell";
import { FormError } from "@/components/FormError";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useOperation } from "@/lib/operations/use-operation";
import { formText } from "@/lib/utils";
import { fieldErrorOf } from "@/lib/operations/field-error";
import { workspaceNameSchema } from "@/features/rooms/domain/commands";
import { teamWorkspaceAction } from "../actions";
import type { loader } from "@/app/routes/workspace/teams";

export const roleLabels = { owner: "Dono", manager: "Gestor", member: "Membro" };
export function TeamListPage() {
  const data = useLoaderData<typeof loader>();
  const id = useId();
  const navigate = useNavigate();
  const action = useOperation(teamWorkspaceAction, {
    onSuccess: ({ data: result }) => void navigate(`/times/${result.teamId}`),
  });
  // Only spaces pass the browser's minLength; the server trims and refuses them too.
  const [nameError, setNameError] = useState<string>();
  const shownError = nameError ?? fieldErrorOf(action.result, "name");
  return (
    <WorkspaceShell
      account={data.account}
      title="Seus times"
      description="Reúna as pessoas, mantenha as salas do time e acompanhe o histórico de chamadas."
    >
      <div className="grid gap-4 sm:grid-cols-2">
        {data.teams.map((team) => (
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
      {!data.enabled ? (
        <output className="text-sm text-warning">
          Times aguardam a ativação dos controles de anfitrião nesta instância.
        </output>
      ) : null}
      {!data.teams.length ? (
        <p className="text-ink-muted">
          Você ainda não faz parte de um time. Aceite um convite ou crie seu próprio time.
        </p>
      ) : null}
      <section className="panel flex max-w-lg flex-col gap-4 rounded-2xl p-6">
        <h2 className="text-xl font-semibold">Criar um time</h2>
        <p className="text-sm text-ink-muted">
          O Pro beta pessoal permite criar até 3 times. As salas e convites de cada time precisam de
          uma ativação própria, feita pela equipe Nelcota.
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
            disabled={!data.pro.active}
            aria-invalid={shownError ? true : undefined}
            aria-describedby={shownError ? `${id}-error` : undefined}
            onChange={() => setNameError(undefined)}
          />
          <FormError id={`${id}-error`} message={shownError} />
          <Button type="submit" disabled={action.isPending || !data.pro.active || !data.enabled}>
            Criar time
          </Button>
          <FormError message={action.result.serverError} />
        </form>
        {!data.pro.active ? (
          <output className="text-sm text-warning">
            O Pro beta pessoal está inativo. Os times dos quais você participa continuam
            disponíveis.
          </output>
        ) : null}
      </section>
    </WorkspaceShell>
  );
}

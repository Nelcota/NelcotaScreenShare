import { Link, useLoaderData, useNavigate } from "react-router";
import { WorkspaceShell } from "@/components/workspace/WorkspaceShell";
import { FormError } from "@/components/FormError";
import { Button } from "@/components/ui/button";
import { useOperation } from "@/lib/operations/use-operation";
import { teamWorkspaceAction } from "../actions";
import type { loader } from "@/app/routes/workspace/invitation";

export function InvitationPage() {
  const data = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const action = useOperation(teamWorkspaceAction, {
    onSuccess: ({ data: result }) => void navigate(`/times/${result.teamId}`),
  });
  return (
    <WorkspaceShell
      account={data.account}
      title="Convite de time"
      description="A aceitação usa sua conta e seu e-mail confirmado."
    >
      <div className="panel flex max-w-lg flex-col gap-4 rounded-2xl p-6">
        {data.error ? (
          <p role="alert">{data.error}</p>
        ) : (
          <>
            <p>
              Você foi convidado para <strong>{data.teamName}</strong> como{" "}
              {data.role === "manager" ? "gestor" : "membro"}.
            </p>
            {!data.verified ? (
              <>
                <p className="text-sm text-warning">
                  Confirme o e-mail desta conta para aceitar o convite.
                </p>
                <Button asChild>
                  <Link
                    to={`/verificar-email?voltar=${encodeURIComponent(`/times/convite/${data.token}`)}`}
                  >
                    Confirmar e-mail
                  </Link>
                </Button>
              </>
            ) : (
              <Button
                disabled={action.isPending}
                onClick={() => action.execute({ kind: "accept", token: data.token })}
              >
                Aceitar convite
              </Button>
            )}
          </>
        )}
        <FormError message={action.result.serverError} />
        <Button asChild variant="ghost">
          <Link to="/times">Voltar aos times</Link>
        </Button>
      </div>
    </WorkspaceShell>
  );
}

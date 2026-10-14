import { useState } from "react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Button } from "@/components/ui/button";
import type { TeamCommand } from "../domain/commands";
import type { TeamRole } from "../domain/team-policy";
import { roleLabels } from "./TeamListPage";

export function TeamMembers({
  teamId,
  actor,
  role,
  members,
  pending,
  onCommand,
}: {
  teamId: string;
  actor: string;
  role: TeamRole;
  members: { id: string; name: string; role: TeamRole }[];
  pending: boolean;
  onCommand: (command: TeamCommand) => void;
}) {
  const [confirm, setConfirm] = useState<{
    kind: "remove" | "transfer";
    id: string;
    name: string;
  }>();
  return (
    <section className="panel flex flex-col gap-4 rounded-2xl p-5">
      <h2 className="text-xl font-semibold">Membros</h2>
      <p className="text-sm text-ink-muted">
        O dono administra o time e sua propriedade. Gestores cuidam de salas, convites e membros.
        Membros acessam as salas e o histórico.
      </p>
      <ul className="divide-y divide-line">
        {members.map((person) => (
          <li key={person.id} className="flex flex-wrap items-center justify-between gap-3 py-4">
            <div className="min-w-0">
              <p className="font-medium wrap-anywhere">
                {person.name}
                {person.id === actor ? " (você)" : ""}
              </p>
              <p className="text-sm text-ink-muted">{roleLabels[person.role]}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {role === "owner" && person.role !== "owner" ? (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={pending}
                    onClick={() =>
                      onCommand({
                        kind: "role",
                        teamId,
                        userId: person.id,
                        role: person.role === "member" ? "manager" : "member",
                      })
                    }
                  >
                    {person.role === "member" ? "Tornar gestor" : "Tornar membro"}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={pending}
                    onClick={() =>
                      setConfirm({ kind: "transfer", id: person.id, name: person.name })
                    }
                  >
                    Transferir propriedade
                  </Button>
                </>
              ) : null}
              {person.role !== "owner" && (role !== "member" || person.id === actor) ? (
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={pending}
                  onClick={() => setConfirm({ kind: "remove", id: person.id, name: person.name })}
                >
                  {person.id === actor ? "Sair do time" : "Remover"}
                </Button>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
      <ConfirmDialog
        open={Boolean(confirm)}
        onOpenChange={(open) => {
          if (!open) setConfirm(undefined);
        }}
        title={confirm?.kind === "transfer" ? "Transferir propriedade?" : "Remover do time?"}
        description={
          confirm?.kind === "transfer"
            ? `${confirm.name} será o novo dono. Você continuará como gestor.`
            : `${confirm?.name ?? "Esta pessoa"} perderá acesso às salas e será desconectada das chamadas do time.`
        }
        confirmLabel={confirm?.kind === "transfer" ? "Transferir propriedade" : "Confirmar remoção"}
        danger={confirm?.kind === "remove"}
        pending={pending}
        onConfirm={() => {
          if (!confirm) return;
          onCommand({ kind: confirm.kind, teamId, userId: confirm.id });
          setConfirm(undefined);
        }}
      />
    </section>
  );
}

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/FormError";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { RoomEditor } from "./RoomEditor";
import { RoomCard, type WorkspaceRoom } from "./RoomCard";
import type { RoomWorkspaceCommand } from "@/features/rooms/domain/commands";

export function RoomCollection({
  rooms,
  teamId,
  pro,
  canCreate,
  enabled,
  pending,
  error,
  onCommand,
}: {
  rooms: WorkspaceRoom[];
  teamId?: string;
  pro: { active: boolean; roomLimit: number };
  canCreate: boolean;
  enabled: boolean;
  pending: boolean;
  error?: string;
  onCommand: (input: RoomWorkspaceCommand) => void;
}) {
  const [creating, setCreating] = useState(false);
  const [tab, setTab] = useState("active");
  const visible = rooms.filter((room) => {
    if (tab === "favorites") return room.favorite && !room.archivedAt;
    if (tab === "archived") return Boolean(room.archivedAt);
    return !room.archivedAt;
  });
  const used = rooms.filter(
    (room) => !room.archivedAt && Boolean(room.teamId) === Boolean(teamId),
  ).length;
  return (
    <section className="flex flex-col gap-4" aria-label="Salas permanentes">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink-muted">
          {pro.active
            ? `${used} de ${pro.roomLimit} salas no Pro beta`
            : "Pro beta inativo · Seu histórico continua disponível"}
        </p>
        {canCreate ? (
          <Button
            disabled={pending || !pro.active || !enabled || used >= pro.roomLimit}
            onClick={() => setCreating(true)}
          >
            Nova sala
          </Button>
        ) : null}
      </div>
      {!enabled ? (
        <output className="text-sm text-warning">
          Salas permanentes aguardam a ativação dos controles de anfitrião nesta instância.
        </output>
      ) : null}
      {!pro.active && canCreate ? (
        <p className="text-sm text-ink-muted">
          A ativação do piloto é feita pela equipe Nelcota. Não há cobrança automática.
        </p>
      ) : null}
      <FormError message={error} />
      <fieldset aria-label="Filtrar salas" className="flex flex-wrap gap-2">
        {[
          { id: "active", label: "Minhas salas" },
          { id: "favorites", label: "Favoritas" },
          { id: "archived", label: "Arquivadas" },
        ].map((item) => (
          <Button
            key={item.id}
            variant={tab === item.id ? "secondary" : "ghost"}
            aria-pressed={tab === item.id}
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </Button>
        ))}
      </fieldset>
      {visible.length ? (
        <div className="grid gap-4 md:grid-cols-2">
          {visible.map((room) => (
            <RoomCard key={room.id} room={room} pending={pending} onCommand={onCommand} />
          ))}
        </div>
      ) : (
        <p className="rounded-2xl border border-dashed border-line p-8 text-center text-ink-muted">
          Nenhuma sala neste filtro.
        </p>
      )}
      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova sala permanente</DialogTitle>
            <DialogDescription>
              Use o mesmo link em todas as chamadas. Cada chamada tem seu próprio anfitrião e
              histórico.
            </DialogDescription>
          </DialogHeader>
          <RoomEditor
            team={Boolean(teamId)}
            pending={pending}
            onSave={(values) => {
              onCommand({ kind: "create", teamId, ...values });
              setCreating(false);
            }}
          />
        </DialogContent>
      </Dialog>
    </section>
  );
}

import { useState } from "react";
import { useMatches, useSearchParams } from "react-router";
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
import { isRoomFilter, roomFilterFrom, withRoomFilter } from "./room-filter";
import type { RoomWorkspaceCommand } from "@/features/rooms/domain/commands";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

export function RoomCollection({
  rooms,
  teamId,
  pro,
  canCreate,
  enabled,
  pending,
  error,
  saved = 0,
  nameError,
  onCommand,
}: {
  rooms: WorkspaceRoom[];
  teamId?: string;
  pro: { active: boolean; roomLimit: number };
  canCreate: boolean;
  enabled: boolean;
  pending: boolean;
  error?: string;
  /** Saves that went through so far: a dialog opened before the next one closes on it. */
  saved?: number;
  /** The server's message for the room name, from the last save. */
  nameError?: string;
  onCommand: (input: RoomWorkspaceCommand) => void;
}) {
  // The dialog stays open until the room is really created; a refused name keeps it open.
  const [openedAt, setOpenedAt] = useState<number | null>(null);
  const creating = openedAt === saved;
  const setCreating = (open: boolean) => setOpenedAt(open ? saved : null);
  const [ownTab, setTab] = useState("active");
  // Inside the app the personal room filter lives in the address (?filtro=), shared with the
  // column: this row hides where the column shows the same three filters and stays on
  // phones. Team pages and the standalone page keep their own state.
  const [params, setParams] = useSearchParams();
  const inApp = useMatches().some((match) => match.id === "app");
  const columnFilter = inApp && !teamId;
  const tab = columnFilter ? roomFilterFrom(params) : ownTab;
  const choose = (next: string) => {
    if (!columnFilter) return setTab(next);
    if (!isRoomFilter(next)) return;
    setParams((current) => withRoomFilter(current, next), {
      replace: true,
      preventScrollReset: true,
    });
  };
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
      <ToggleGroup
        type="single"
        size="lg"
        aria-label="Filtrar salas"
        value={tab}
        onValueChange={(next) => {
          if (next) choose(next);
        }}
        className={columnFilter ? "flex-wrap gap-2 sm:hidden" : "flex-wrap gap-2"}
      >
        {[
          { id: "active", label: "Minhas salas" },
          { id: "favorites", label: "Favoritas" },
          { id: "archived", label: "Arquivadas" },
        ].map((item) => (
          <ToggleGroupItem key={item.id} value={item.id} className="font-medium">
            {item.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      {visible.length ? (
        <div className="grid gap-4 md:grid-cols-2">
          {visible.map((room) => (
            <RoomCard
              key={room.id}
              room={room}
              pending={pending}
              saved={saved}
              nameError={nameError}
              onCommand={onCommand}
            />
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
            error={nameError}
            onSave={(values) => onCommand({ kind: "create", teamId, ...values })}
          />
        </DialogContent>
      </Dialog>
    </section>
  );
}

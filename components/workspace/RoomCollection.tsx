import { Video } from "lucide-react";
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
import { ProOnlyNotice } from "./ProOnlyNotice";
import { RoomEditor } from "./RoomEditor";
import { RoomCard, type WorkspaceRoom } from "./RoomCard";
import { isRoomFilter, roomFilterFrom, withRoomFilter } from "./room-filter";
import type { RoomWorkspaceCommand } from "@/features/rooms/domain/commands";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

/** No Pro and no rooms: only the Pro notice, as on Times, with no dead controls. */
export function showsProNotice(pro: { active: boolean }, rooms: readonly unknown[]): boolean {
  return !pro.active && rooms.length === 0;
}

/**
 * The Pro notice for rooms. Your rooms: the whole page, like Times. A team's rooms: one part
 * of the team page, under its title.
 */
const PRO_NOTICES = {
  personal: {
    title: "Minhas salas",
    description: "Salas que ficam sempre no mesmo link, com o histórico das chamadas.",
    heading: "h1",
    className: "min-h-[calc(100dvh-12rem)] py-12",
  },
  team: {
    title: "Salas do time",
    description: "Salas que ficam sempre no mesmo link, com o histórico das chamadas do time.",
    heading: "h2",
    className: "panel rounded-2xl px-6 py-10",
  },
} as const;

function WithoutPro({ team }: { team: boolean }) {
  const notice = PRO_NOTICES[team ? "team" : "personal"];
  return <ProOnlyNotice icon={Video} note="Por enquanto, crie uma sala pelo Início." {...notice} />;
}

/** Why "Nova sala" is off, when it is. */
function CreationNotes({ enabled, needsPro }: { enabled: boolean; needsPro: boolean }) {
  return (
    <>
      {enabled ? null : (
        <output className="text-sm text-warning">Salas fixas ainda não estão disponíveis.</output>
      )}
      {needsPro ? <p className="text-sm text-ink-muted">Salas novas precisam do Pro.</p> : null}
    </>
  );
}

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
  addressError,
  checkAddress,
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
  /** The server's message for the chosen address (format, taken, reserved), from the last save. */
  addressError?: string;
  /** The address rule; with it, a new room may choose its address. */
  checkAddress?: (code: string) => string | undefined;
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
  if (showsProNotice(pro, rooms)) return <WithoutPro team={Boolean(teamId)} />;
  return (
    <section className="flex flex-col gap-4" aria-label="Salas permanentes">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink-muted">
          {pro.active
            ? `${used} de ${pro.roomLimit} salas no Pro beta`
            : "Pro desativado. Suas salas e o histórico continuam aqui."}
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
      <CreationNotes enabled={enabled} needsPro={!pro.active && canCreate} />
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
            addressError={addressError}
            checkAddress={checkAddress}
            onSave={(values) => onCommand({ kind: "create", teamId, ...values })}
          />
        </DialogContent>
      </Dialog>
    </section>
  );
}

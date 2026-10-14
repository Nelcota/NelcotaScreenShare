import { useState } from "react";
import { Link } from "react-router";
import { Copy, Star } from "lucide-react";

import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { RoomEditor } from "./RoomEditor";
import type { RoomWorkspaceCommand } from "@/features/rooms/domain/commands";
import { copyText } from "@/lib/clipboard";

export interface WorkspaceRoom {
  id: string;
  name: string | null;
  code: string;
  archivedAt: Date | null;
  teamId: string | null;
  allowGuests: boolean;
  memberCanHost: boolean;
  canManage: boolean;
  favorite: boolean;
}
export async function copyWorkspaceLink(path: string) {
  await copyText(new URL(path, location.origin).href, {
    context: "Workspace link copy failed",
    success: "Link copiado.",
    failure: "Não foi possível copiar. Abra a sala e copie o endereço.",
  });
}
export function RoomCard({
  room,
  pending,
  onCommand,
}: {
  room: WorkspaceRoom;
  pending: boolean;
  onCommand: (input: RoomWorkspaceCommand) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const link = `/sala/${room.code}`;
  const history = room.teamId ? `/times/${room.teamId}/salas/${room.id}` : `/salas/${room.id}`;
  return (
    <article className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold break-words">{room.name}</h2>
          <p className="mt-1 text-xs text-ink-muted">
            {room.archivedAt ? "Arquivada" : room.teamId ? "Sala de time" : "Sala pessoal"} · Link
            permanente
          </p>
        </div>
        <Button
          size="icon"
          variant="ghost"
          disabled={pending || (Boolean(room.archivedAt) && !room.favorite)}
          aria-label={room.favorite ? `Desfavoritar ${room.name}` : `Favoritar ${room.name}`}
          aria-pressed={room.favorite}
          onClick={() => onCommand({ kind: "favorite", roomId: room.id, favorite: !room.favorite })}
        >
          <Star className={room.favorite ? "fill-yellow-300 text-yellow-300" : undefined} />
        </Button>
      </div>
      <div className="flex flex-wrap gap-2">
        {!room.archivedAt ? (
          <>
            <Button asChild>
              <Link to={link}>Abrir sala</Link>
            </Button>
            <Button
              variant="outline"
              aria-label={`Copiar link de ${room.name}`}
              onClick={() => void copyWorkspaceLink(link)}
            >
              <Copy aria-hidden="true" />
              Copiar link
            </Button>
          </>
        ) : null}
        <Button asChild variant="ghost">
          <Link to={history}>Histórico</Link>
        </Button>
        {room.canManage ? (
          <>
            <Button variant="ghost" disabled={pending} onClick={() => setEditing(true)}>
              Editar
            </Button>
            <Button variant="ghost" disabled={pending} onClick={() => setArchiving(true)}>
              {room.archivedAt ? "Restaurar" : "Arquivar"}
            </Button>
          </>
        ) : null}
      </div>
      <Dialog open={editing} onOpenChange={setEditing}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar sala</DialogTitle>
            <DialogDescription>
              O link permanece igual. As permissões valem também para novas entradas na chamada.
            </DialogDescription>
          </DialogHeader>
          <RoomEditor
            key={room.name}
            initial={{
              name: room.name ?? "",
              allowGuests: room.allowGuests,
              memberCanHost: room.memberCanHost,
            }}
            team={Boolean(room.teamId)}
            pending={pending}
            onSave={(values) => {
              onCommand({ kind: "edit", roomId: room.id, ...values });
              setEditing(false);
            }}
          />
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={archiving}
        onOpenChange={setArchiving}
        title={room.archivedAt ? "Restaurar sala?" : "Arquivar sala?"}
        description={
          room.archivedAt
            ? "A sala voltará a usar uma vaga do Pro beta."
            : "Encerre a chamada ativa primeiro. O histórico continuará disponível e o link recusará novas entradas."
        }
        confirmLabel={room.archivedAt ? "Restaurar sala" : "Arquivar sala"}
        pending={pending}
        onConfirm={() => {
          onCommand({ kind: "archive", roomId: room.id, archived: !room.archivedAt });
          setArchiving(false);
        }}
      />
    </article>
  );
}

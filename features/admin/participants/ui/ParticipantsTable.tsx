import { Hint } from "@/components/Hint";
import { Ban, LockOpen, Trash2 } from "lucide-react";
import { useOperation } from "@/lib/operations/use-operation";
import { Link } from "react-router";
import { debounce, useQueryStates } from "nuqs";
import { useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { toastWithUndo } from "@/lib/undo-toast";
import type { PageInfo } from "@/components/data-table/page-info";
import {
  DataTable,
  useTableTransition,
  type DataTableColumn,
} from "@/components/data-table/DataTable";
import {
  FilterActions,
  FilterDate,
  FilterSearch,
  FilterSelect,
  SortDirection,
} from "@/components/data-table/filters";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { formatDateTime, formatNumber, formatRelative } from "@/lib/format";
import { filterState, resetPage, type BulkSelection } from "@/lib/table-params";
import {
  blockParticipantsAction,
  deleteParticipantsAction,
  restoreParticipantsAction,
  unblockParticipantsAction,
} from "@/features/admin/participants/actions";
import {
  BLOCK_DESCRIPTION,
  SORT_OPTIONS,
  STATUS_LABELS,
  STATUS_OPTIONS,
} from "@/features/admin/participants/domain/labels";
import type { ParticipantRow } from "@/features/admin/participants/server/queries.server";
import {
  PARTICIPANT_FILTERS,
  participantParsers,
} from "@/features/admin/participants/domain/search-params";
import { toastError } from "@/features/admin/shell/ui/toast-error";

export interface ParticipantPermissions {
  update: boolean;
  delete: boolean;
}

function Filters({ exportHref }: { exportHref: string | null }) {
  const startTransition = useTableTransition();
  const [params, setParams] = useQueryStates(participantParsers, {
    shallow: false,
    startTransition,
  });
  const filters = filterState(PARTICIPANT_FILTERS, params);
  return (
    <>
      <FilterSearch
        label="Nome ou e-mail"
        placeholder="Buscar"
        value={params.q}
        onChange={(term) =>
          void setParams({ q: term || null, ...resetPage }, { limitUrlUpdates: debounce(350) })
        }
      />
      <FilterSelect
        label="Status"
        value={params.status}
        options={STATUS_OPTIONS}
        allLabel="Todos (menos excluídos)"
        onChange={(status) => void setParams({ status, ...resetPage })}
      />
      <FilterDate
        label="Cadastro de"
        value={params.de}
        onChange={(de) => void setParams({ de, ...resetPage })}
      />
      <FilterDate
        label="até"
        value={params.ate}
        onChange={(ate) => void setParams({ ate, ...resetPage })}
      />
      <FilterSelect
        label="Ordenar por"
        value={params.por}
        options={SORT_OPTIONS}
        onChange={(por) => void setParams({ por, ...resetPage })}
      />
      <SortDirection
        value={params.ordem}
        onChange={(ordem) => void setParams({ ordem, ...resetPage })}
      />
      <FilterActions
        active={filters.active}
        exportHref={exportHref}
        onClear={() => void setParams({ ...filters.cleared, ...resetPage })}
      />
    </>
  );
}

function NameCell({ row }: { row: ParticipantRow }) {
  return (
    <Link viewTransition to={`/admin/usuarios/${row.id}`} className="group flex flex-col">
      <span className="flex items-center gap-1.5">
        <span className="font-medium group-hover:underline">{row.name}</span>
        {row.twoFactorEnabled ? <StatusBadge tone="neutral">2FA</StatusBadge> : null}
      </span>
      <span className="text-xs text-ink-muted">{row.email}</span>
    </Link>
  );
}

function StatusCell({ row }: { row: ParticipantRow }) {
  const status = STATUS_LABELS[row.status];
  return <StatusBadge tone={status.tone}>{status.label}</StatusBadge>;
}

function LastSeenCell({ row }: { row: ParticipantRow }) {
  if (!row.lastSeenAt) return <span className="text-ink-subtle">Nunca</span>;
  return (
    <Hint text={formatDateTime(row.lastSeenAt)}>
      <button
        type="button"
        className="rounded-sm text-left"
        aria-label={formatDateTime(row.lastSeenAt)}
      >
        <time dateTime={row.lastSeenAt} suppressHydrationWarning>
          {formatRelative(row.lastSeenAt)}
        </time>
      </button>
    </Hint>
  );
}

const COLUMNS: DataTableColumn<ParticipantRow>[] = [
  { id: "nome", header: "Participante", cell: ({ row }) => <NameCell row={row.original} /> },
  { id: "status", header: "Status", cell: ({ row }) => <StatusCell row={row.original} /> },
  {
    id: "cadastro",
    header: "Cadastro",
    cell: ({ row }) => (
      <span className="whitespace-nowrap">
        {formatDateTime(row.original.createdAt).split(",")[0]}
      </span>
    ),
  },
  { id: "acesso", header: "Último acesso", cell: ({ row }) => <LastSeenCell row={row.original} /> },
  {
    id: "participacoes",
    header: "Participações",
    cell: ({ row }) => (
      <span className="tabular-nums">{formatNumber(row.original.participations)}</span>
    ),
  },
];

function ParticipantCard({ row }: { row: ParticipantRow }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <NameCell row={row} />
      <span className="flex flex-col items-end gap-1 text-xs text-ink-muted">
        <StatusCell row={row} />
        {formatNumber(row.participations)} participações
      </span>
    </div>
  );
}

function renderCard(row: ParticipantRow) {
  return <ParticipantCard row={row} />;
}

function plural(count: number, one: string, many: string) {
  return count === 1 ? `1 ${one}` : `${formatNumber(count)} ${many}`;
}

function BulkActions({
  selection,
  clear,
  count,
  can,
}: {
  selection: BulkSelection;
  clear: () => void;
  count: number;
  can: ParticipantPermissions;
}) {
  const [dialog, setDialog] = useState<"block" | "delete" | null>(null);
  const block = useOperation(blockParticipantsAction, {
    onSuccess: ({ data }) => {
      toast.success(
        `${plural(data.count, "conta bloqueada", "contas bloqueadas")}. Sessões encerradas.`,
      );
      setDialog(null);
      clear();
    },
    onError: toastError("Não foi possível bloquear."),
  });
  const unblock = useOperation(unblockParticipantsAction, {
    onSuccess: ({ data }) => {
      toast.success(`${plural(data.count, "conta desbloqueada", "contas desbloqueadas")}.`);
      clear();
    },
    onError: toastError("Não foi possível desbloquear."),
  });
  const remove = useOperation(deleteParticipantsAction, {
    onSuccess: ({ data }) => {
      setDialog(null);
      clear();
      toastWithUndo(
        data.ids.length === 1
          ? "Conta excluída"
          : `${formatNumber(data.ids.length)} contas excluídas`,
        () => restoreParticipantsAction({ ids: data.ids }),
        `${plural(data.ids.length, "conta restaurada", "contas restauradas")}.`,
      );
    },
    onError: toastError("Não foi possível excluir."),
  });
  const target = plural(count, "conta", "contas");

  return (
    <>
      {can.update ? (
        <>
          <Button variant="outline" size="sm" onClick={() => setDialog("block")}>
            <Ban aria-hidden="true" />
            Bloquear
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={unblock.isPending}
            onClick={() => unblock.execute({ selection })}
          >
            <LockOpen aria-hidden="true" />
            Desbloquear
          </Button>
        </>
      ) : null}
      {can.delete ? (
        <Button variant="destructive" size="sm" onClick={() => setDialog("delete")}>
          <Trash2 aria-hidden="true" />
          Excluir
        </Button>
      ) : null}
      <ConfirmDialog
        open={dialog === "block"}
        onOpenChange={(open) => setDialog(open ? "block" : null)}
        title={`Bloquear ${target}?`}
        description={BLOCK_DESCRIPTION}
        confirmLabel="Bloquear"
        danger
        pending={block.isPending}
        reason={{ label: "Motivo (fica no histórico)", maxLength: 300 }}
        onConfirm={(reason) => block.execute({ selection, reason })}
      />
      <ConfirmDialog
        open={dialog === "delete"}
        onOpenChange={(open) => setDialog(open ? "delete" : null)}
        title={`Excluir ${target}?`}
        description="As contas somem das listas e não entram mais. Dá para desfazer logo depois ou restaurar pelo filtro “Excluído”."
        confirmLabel="Excluir"
        danger
        pending={remove.isPending}
        onConfirm={() => remove.execute({ selection })}
      />
    </>
  );
}

export function ParticipantsTable({
  rows,
  page,
  can,
  exportHref,
}: {
  rows: ParticipantRow[];
  page: PageInfo;
  can: ParticipantPermissions;
  exportHref: string | null;
}) {
  const selectable = can.update || can.delete;
  const bulkActions = (selection: BulkSelection, clear: () => void, count: number) => (
    <BulkActions selection={selection} clear={clear} count={count} can={can} />
  );
  return (
    <DataTable
      label="Participantes"
      columns={COLUMNS}
      data={rows}
      page={page}
      emptyMessage="Nenhum participante com esses filtros."
      toolbar={<Filters exportHref={exportHref} />}
      bulkActions={selectable ? bulkActions : undefined}
      renderCard={renderCard}
    />
  );
}

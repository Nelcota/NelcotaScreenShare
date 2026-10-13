import { Trash2 } from "lucide-react";
import { useOperation } from "@/lib/operations/use-operation";
import { Link } from "react-router";
import { debounce, useQueryStates } from "nuqs";
import { useState } from "react";
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
import { Button } from "@/components/ui/button";
import { formatDateTime, formatNumber, formatSpan } from "@/lib/format";
import { filterState, resetPage, type BulkSelection } from "@/lib/table-params";
import { deleteRoomsAction, restoreRoomsAction } from "@/features/admin/rooms/actions";
import type { RoomRow } from "@/features/admin/rooms/server/queries.server";
import { ROOM_FILTERS, roomParsers } from "@/features/admin/rooms/domain/search-params";
import { STATUS_OPTIONS } from "@/features/admin/rooms/domain/labels";
import { RoomStatus } from "./RoomStatus";
import { toastError } from "@/features/admin/shell/ui/toast-error";

const SORT_OPTIONS = [
  { value: "atividade", label: "Última atividade" },
  { value: "inicio", label: "Início" },
  { value: "pico", label: "Pico de pessoas" },
] as const;

function Filters({ exportHref }: { exportHref: string | null }) {
  const startTransition = useTableTransition();
  const [params, setParams] = useQueryStates(roomParsers, { shallow: false, startTransition });
  const filters = filterState(ROOM_FILTERS, params);
  return (
    <>
      <FilterSearch
        label="Código"
        placeholder="Buscar por código"
        value={params.q}
        onChange={(term) =>
          void setParams({ q: term || null, ...resetPage }, { limitUrlUpdates: debounce(350) })
        }
      />
      <FilterSelect
        label="Status"
        value={params.status}
        options={STATUS_OPTIONS}
        allLabel="Todas (menos excluídas)"
        onChange={(status) => void setParams({ status, ...resetPage })}
      />
      <FilterDate
        label="Início de"
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

function CodeCell({ row }: { row: RoomRow }) {
  return (
    <Link
      viewTransition
      to={`/admin/salas/${row.id}`}
      className="font-sans text-sm font-medium tabular-nums hover:underline"
    >
      {row.code}
    </Link>
  );
}

const COLUMNS: DataTableColumn<RoomRow>[] = [
  { id: "codigo", header: "Código", cell: ({ row }) => <CodeCell row={row.original} /> },
  {
    id: "status",
    header: "Status",
    cell: ({ row }) => <RoomStatus status={row.original.status} deleted={row.original.deleted} />,
  },
  {
    id: "inicio",
    header: "Início",
    cell: ({ row }) => (
      <span className="whitespace-nowrap">{formatDateTime(row.original.startedAt)}</span>
    ),
  },
  {
    id: "fim",
    header: "Fim",
    cell: ({ row }) => (
      <span className="whitespace-nowrap text-ink-muted">
        {row.original.finishedAt ? formatDateTime(row.original.finishedAt) : "—"}
      </span>
    ),
  },
  {
    id: "duracao",
    header: "Duração",
    cell: ({ row }) => (
      <span className="whitespace-nowrap">
        {formatSpan(row.original.startedAt, row.original.finishedAt)}
      </span>
    ),
  },
  {
    id: "pico",
    header: "Pico",
    cell: ({ row }) => <span className="tabular-nums">{row.original.peak}</span>,
  },
  {
    id: "compartilhamentos",
    header: "Compartilhamentos",
    cell: ({ row }) => <span className="tabular-nums">{formatNumber(row.original.shares)}</span>,
  },
];

function renderCard(row: RoomRow) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="flex flex-col gap-1">
        <CodeCell row={row} />
        <span className="text-xs text-ink-muted">
          {formatDateTime(row.startedAt)} · {formatSpan(row.startedAt, row.finishedAt)}
        </span>
      </span>
      <span className="flex flex-col items-end gap-1 text-xs text-ink-muted">
        <RoomStatus status={row.status} deleted={row.deleted} />
        pico {row.peak} · {row.shares} compart.
      </span>
    </div>
  );
}

function BulkActions({
  selection,
  clear,
  count,
}: {
  selection: BulkSelection;
  clear: () => void;
  count: number;
}) {
  const [open, setOpen] = useState(false);
  const remove = useOperation(deleteRoomsAction, {
    onSuccess: ({ data }) => {
      setOpen(false);
      clear();
      toastWithUndo(
        data.ids.length === 1
          ? "Sala excluída"
          : `${formatNumber(data.ids.length)} salas excluídas`,
        () => restoreRoomsAction({ ids: data.ids }),
        data.ids.length === 1 ? "Sala restaurada." : "Salas restauradas.",
      );
    },
    onError: toastError("Não foi possível excluir."),
  });
  return (
    <>
      <Button variant="destructive" size="sm" onClick={() => setOpen(true)}>
        <Trash2 aria-hidden="true" />
        Excluir
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={count === 1 ? "Excluir 1 sala?" : `Excluir ${formatNumber(count)} salas?`}
        description="As salas somem das listas. Salas ao vivo não podem ser excluídas."
        confirmLabel="Excluir"
        danger
        pending={remove.isPending}
        onConfirm={() => remove.execute({ selection })}
      />
    </>
  );
}

function bulkActions(selection: BulkSelection, clear: () => void, count: number) {
  return <BulkActions selection={selection} clear={clear} count={count} />;
}

export function RoomsTable({
  rows,
  page,
  canDelete,
  exportHref,
}: {
  rows: RoomRow[];
  page: PageInfo;
  canDelete: boolean;
  exportHref: string | null;
}) {
  return (
    <DataTable
      label="Salas"
      columns={COLUMNS}
      data={rows}
      page={page}
      emptyMessage="Nenhuma sala com esses filtros."
      toolbar={<Filters exportHref={exportHref} />}
      bulkActions={canDelete ? bulkActions : undefined}
      renderCard={renderCard}
    />
  );
}

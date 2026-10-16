import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { actionLabel, actorText, resourceLabel } from "@/features/admin/audit/domain/labels";
import type { AuditRow } from "@/features/admin/audit/server/queries.server";
import { formatDateTime } from "@/lib/format";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

function value(recorded: unknown): string {
  if (recorded === null || recorded === undefined) return "—";
  return typeof recorded === "string" ? recorded : JSON.stringify(recorded);
}

/** Side panel with everything recorded for an event (before → after, details). */
export function AuditDetail({ row, onClose }: { row: AuditRow | null; onClose: () => void }) {
  return (
    <Sheet open={row !== null} onOpenChange={(open) => (open ? null : onClose())}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        {row ? (
          <>
            <SheetHeader>
              <SheetTitle>{actionLabel(row.action)}</SheetTitle>
              <SheetDescription>
                {formatDateTime(row.createdAt)} · {actorText(row.actor)}
              </SheetDescription>
            </SheetHeader>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 px-4 text-sm">
              <dt className="text-ink-subtle">Ação</dt>
              <dd className="font-sans text-xs break-all tabular-nums">{row.action}</dd>
              <dt className="text-ink-subtle">Recurso</dt>
              <dd className="break-all">
                {resourceLabel(row.resourceType)}{" "}
                {row.resourceId ? (
                  <code className="font-sans text-xs tabular-nums">{row.resourceId}</code>
                ) : null}
              </dd>
              {row.actor.kind === "admin" ? (
                <>
                  <dt className="text-ink-subtle">E-mail</dt>
                  <dd className="break-all">{row.actor.email}</dd>
                </>
              ) : null}
              <dt className="text-ink-subtle">IP</dt>
              <dd>{row.ip ?? "—"}</dd>
              <dt className="text-ink-subtle">Navegador</dt>
              <dd className="text-xs break-all text-ink-muted">{row.userAgent ?? "—"}</dd>
              <dt className="text-ink-subtle">request_id</dt>
              <dd className="font-sans text-xs break-all tabular-nums">{row.requestId ?? "—"}</dd>
            </dl>
            {row.changes ? (
              <div className="px-4">
                <h3 className="mb-2 text-sm font-medium">Antes → depois</h3>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Campo</TableHead>
                      <TableHead>Antes</TableHead>
                      <TableHead>Depois</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Object.entries(row.changes).map(([field, change]) => (
                      <TableRow key={field} className="align-top">
                        <TableCell className="font-sans text-xs whitespace-normal tabular-nums">
                          {field}
                        </TableCell>
                        <TableCell className="whitespace-normal text-danger">
                          {value(change.antes)}
                        </TableCell>
                        <TableCell className="whitespace-normal text-brand-soft">
                          {value(change.depois)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : null}
            {Object.keys(row.metadata).length > 0 ? (
              <div className="px-4 pb-6">
                <h3 className="mb-2 text-sm font-medium">Detalhes</h3>
                <pre className="overflow-x-auto rounded-xl bg-surface-2 p-3 text-xs">
                  {JSON.stringify(row.metadata, null, 2)}
                </pre>
              </div>
            ) : null}
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

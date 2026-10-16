import type { getReport } from "@/features/admin/reports/server/queries.server";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

type Detail = NonNullable<Awaited<ReturnType<typeof getReport>>>;

function messageText(message: { body: string | null; gifSlug: string | null }): string {
  return message.body ?? `GIF: ${message.gifSlug ?? ""}`;
}

/** The reported message among the ones right before it, from that conversation only. */
export function ReportContext({ detail }: { detail: Detail }) {
  const { report, context } = detail;
  if (context.length === 0 && report.messageExcerpt) {
    return (
      <div className="flex flex-col gap-1 text-sm">
        <p className="text-ink-muted">A mensagem foi apagada. Cópia guardada na denúncia:</p>
        <p className="rounded-xl bg-surface-2 p-3 break-words whitespace-pre-wrap">
          {report.messageExcerpt}
        </p>
      </div>
    );
  }
  if (context.length === 0 && report.targetKind === "message") {
    return <p className="text-sm text-ink-muted">A mensagem foi apagada.</p>;
  }
  if (context.length === 0) return <p className="text-sm text-ink-muted">Sem mensagens.</p>;
  return (
    <ol className="flex flex-col gap-2 text-sm">
      {context.map((message) => {
        const reported = message.id === report.targetMessageId;
        return (
          <li
            key={message.id}
            className={cn(
              "flex flex-col gap-0.5 rounded-xl p-3",
              reported ? "border border-warning/50 bg-warning/10" : "bg-surface-2",
            )}
          >
            <span className="flex flex-wrap items-baseline justify-between gap-x-3">
              <span className="font-medium">{message.authorName ?? "Conta apagada"}</span>
              <span className="text-ink-muted">{formatDateTime(message.createdAt)}</span>
            </span>
            <span className="break-words whitespace-pre-wrap">{messageText(message)}</span>
            {reported ? <span className="text-xs font-medium">Mensagem denunciada</span> : null}
          </li>
        );
      })}
    </ol>
  );
}

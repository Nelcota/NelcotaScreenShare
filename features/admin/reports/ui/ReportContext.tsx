import type { getReport } from "@/features/admin/reports/server/queries.server";
import { ReportedFile, type ReportedFileInfo } from "@/features/admin/reports/ui/ReportedFile";
import { reportedMessageText } from "@/features/reports/domain/reports";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

type Detail = NonNullable<Awaited<ReturnType<typeof getReport>>>;
type Report = Detail["report"];

/** The file the report holds, once the server has checked it. */
function heldFile(report: Report): ReportedFileInfo | null {
  const file = report.file;
  if (file === null || file.kind === null || file.size === null) return null;
  return { fileName: file.fileName, kind: file.kind, size: file.size };
}

/** What the panel says above the copy, by what was kept. */
function copyIntro(file: ReportedFileInfo | null, text: string | null): string {
  if (file === null) return "A mensagem foi apagada. Cópia guardada na denúncia:";
  if (text === null)
    return "A mensagem foi apagada. Arquivo guardado até a denúncia ser resolvida:";
  return "A mensagem foi apagada. Cópia e arquivo guardados até a denúncia ser resolvida:";
}

/** The copy of a deleted message: its text, if it had any, and the file kept with it. */
function DeletedMessageCopy({ report, file }: { report: Report; file: ReportedFileInfo | null }) {
  // A message with only a file was copied as "Arquivo: <name>": the card already says it.
  const fileOnly =
    file !== null &&
    report.messageExcerpt ===
      reportedMessageText({ body: null, gifSlug: null, fileName: file.fileName });
  const text = fileOnly ? null : report.messageExcerpt;
  return (
    <div className="flex flex-col gap-1 text-sm">
      <p className="text-ink-muted">{copyIntro(file, text)}</p>
      {text !== null ? (
        <p className="rounded-xl bg-surface-2 p-3 break-words whitespace-pre-wrap">{text}</p>
      ) : null}
      {file !== null ? <ReportedFile reportId={report.id} file={file} /> : null}
    </div>
  );
}

type ContextMessage = Detail["context"][number];

/** A message in the context; the reported one shows its file as a card. */
function ContextContent({
  message,
  file,
  reportId,
}: {
  message: ContextMessage;
  file: ReportedFileInfo | null;
  reportId: string;
}) {
  if (file === null) {
    return <span className="break-words whitespace-pre-wrap">{reportedMessageText(message)}</span>;
  }
  return (
    <>
      {message.body !== null ? (
        <span className="break-words whitespace-pre-wrap">{message.body}</span>
      ) : null}
      <ReportedFile reportId={reportId} file={file} />
    </>
  );
}

/** The reported message among the ones right before it, from that conversation only. */
export function ReportContext({ detail }: { detail: Detail }) {
  const { report, context } = detail;
  const file = heldFile(report);
  const hasCopy = report.messageExcerpt !== null || file !== null;
  if (context.length === 0 && hasCopy) {
    return <DeletedMessageCopy report={report} file={file} />;
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
            <ContextContent message={message} file={reported ? file : null} reportId={report.id} />
            {reported ? <span className="text-xs font-medium">Mensagem denunciada</span> : null}
          </li>
        );
      })}
    </ol>
  );
}

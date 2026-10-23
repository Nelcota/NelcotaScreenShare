import { Download, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { downloadReportedFileAction } from "@/features/admin/reports/actions";
import { toastError } from "@/features/admin/shell/ui/toast-error";
import {
  kindLabel,
  readableSize,
  type AttachmentKind,
} from "@/features/messages/domain/attachments";
import { useOperation } from "@/lib/operations/use-operation";

export interface ReportedFileInfo {
  fileName: string;
  kind: AttachmentKind;
  size: number;
}

/** Lets the browser save the file from the short link; it always comes as an attachment. */
function save(url: string) {
  const link = document.createElement("a");
  link.href = url;
  link.rel = "noopener";
  link.click();
}

/** The reported message's file: name, kind and size, and a download that is audited. */
export function ReportedFile({ reportId, file }: { reportId: string; file: ReportedFileInfo }) {
  const download = useOperation(downloadReportedFileAction, {
    onSuccess: ({ data }) => save(data.url),
    onError: toastError("Não foi possível baixar o arquivo."),
  });
  return (
    <span className="flex w-full max-w-88 items-center gap-3 rounded-2xl border border-line bg-surface-3 px-3 py-2.5">
      <span className="grid size-10 shrink-0 place-items-center rounded-[0.625rem] bg-brand/15 text-brand-soft">
        <FileText className="size-5" aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-ink">{file.fileName}</span>
        <span className="block text-xs text-ink-subtle">
          {kindLabel(file.kind)} · {readableSize(file.size)}
        </span>
      </span>
      <Button
        variant="outline"
        size="sm"
        className="shrink-0 rounded-full"
        aria-label={`Baixar ${file.fileName}`}
        loading={download.isPending}
        onClick={() => download.execute({ id: reportId })}
      >
        <Download aria-hidden="true" />
        Baixar
      </Button>
    </span>
  );
}

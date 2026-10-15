import { Check, Copy, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { copyText } from "@/lib/clipboard";

async function copyCodes(text: string) {
  await copyText(text, {
    context: "Could not copy the backup codes",
    success: "Códigos copiados.",
    failure: "Não foi possível copiar. Use o botão Baixar .txt.",
  });
}

export function BackupCodes({
  codes,
  onDone,
  scope,
}: {
  codes: string[];
  onDone: () => void;
  scope: "admin" | "user";
}) {
  const text = codes.join("\n");
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-ink-muted">
        Guarde estes códigos num gerenciador de senhas. Se perder o app autenticador, cada um vale
        para um acesso. <strong className="text-ink">Eles não aparecem de novo.</strong>
      </p>
      <ol className="grid grid-cols-2 gap-2 rounded-xl bg-surface-2 p-4 font-sans text-sm tabular-nums">
        {codes.map((code) => (
          <li key={code}>{code}</li>
        ))}
      </ol>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" onClick={() => void copyCodes(text)}>
          <Copy aria-hidden="true" />
          Copiar
        </Button>
        <Button type="button" variant="outline" asChild>
          <a
            href={`data:text/plain;charset=utf-8,${encodeURIComponent(`Códigos de backup ${scope === "admin" ? "do painel " : "do "}Nelcota\n\n${text}\n`)}`}
            download={`nelcota${scope === "admin" ? "-admin" : ""}-codigos-backup.txt`}
          >
            <Download aria-hidden="true" />
            Baixar .txt
          </a>
        </Button>
        <Button type="button" onClick={onDone} className="ml-auto">
          <Check aria-hidden="true" />
          Guardei os códigos
        </Button>
      </div>
    </div>
  );
}

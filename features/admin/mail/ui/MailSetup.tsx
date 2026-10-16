import { TriangleAlert } from "lucide-react";
import type { MailConfiguration } from "@/features/admin/mail/domain/configuration";

/** Missing settings in a warning; otherwise one line with the provider in use. */
export function MailSetup({ configuration }: { configuration: MailConfiguration }) {
  if (configuration.issues.length === 0) {
    return <p className="text-sm text-ink-muted">Enviando pelo {configuration.provider}.</p>;
  }
  return (
    <div
      role="alert"
      className="flex gap-3 rounded-xl border border-warning/40 bg-warning/10 p-3 text-sm"
    >
      <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
      <ul className="flex flex-col gap-1">
        {configuration.issues.map((issue) => (
          <li key={issue}>{issue}</li>
        ))}
      </ul>
    </div>
  );
}

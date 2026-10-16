import { TriangleAlert } from "lucide-react";
import type { MailConfiguration } from "@/features/admin/mail/domain/configuration";
import { Notice } from "@/components/Notice";

/** Missing settings in a warning; otherwise one line with the provider in use. */
export function MailSetup({ configuration }: { configuration: MailConfiguration }) {
  if (configuration.issues.length === 0) {
    return <p className="text-sm text-ink-muted">Enviando pelo {configuration.provider}.</p>;
  }
  return (
    <Notice
      as="div"
      role="alert"
      tone="warning"
      icon={TriangleAlert}
      className="items-start gap-3 p-3 [&>svg]:mt-0.5"
    >
      <ul className="flex flex-col gap-1">
        {configuration.issues.map((issue) => (
          <li key={issue}>{issue}</li>
        ))}
      </ul>
    </Notice>
  );
}

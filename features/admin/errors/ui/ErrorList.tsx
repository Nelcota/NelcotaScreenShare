import { formatDateTime } from "@/lib/format";

interface ErrorItem {
  id: string;
  method: string;
  path: string;
  name: string;
  message: string;
  createdAt: Date | string;
  sentryUrl: string | null;
}

/** Each error stacked: what failed, where and when, with its Sentry link. Fits a phone. */
export function ErrorList({ errors }: { errors: ErrorItem[] }) {
  if (errors.length === 0) {
    return <p className="text-sm text-ink-muted">Nenhum erro nos últimos 30 dias.</p>;
  }
  return (
    <ul className="flex flex-col divide-y divide-line text-sm">
      {errors.map((error) => (
        <li key={error.id} className="flex flex-col gap-0.5 py-2">
          <span className="flex flex-wrap items-baseline justify-between gap-x-4">
            <span className="font-medium break-words">{error.message}</span>
            <span className="shrink-0 text-ink-muted">{formatDateTime(error.createdAt)}</span>
          </span>
          <span className="break-all text-ink-muted">
            {error.name} · {error.method} {error.path}
          </span>
          {error.sentryUrl ? (
            <a
              href={error.sentryUrl}
              target="_blank"
              rel="noreferrer"
              className="w-fit font-medium text-ink underline underline-offset-2"
            >
              Abrir no Sentry
            </a>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

/** Bearer links belong in the browser address, never in error or transaction telemetry. */
export function redactTelemetryUrl(value: string): string {
  return (value.split(/[?#]/, 1)[0] ?? "").replace(
    /(\/(?:times|admin)\/convite\/)[^/]+/g,
    "$1[redacted]",
  );
}

interface UrlEvent {
  request?: { url?: string };
  transaction?: string;
  breadcrumbs?: { data?: Record<string, unknown> }[];
  spans?: { description?: string; data?: Record<string, unknown> }[];
}
export function redactTelemetryUrls<T extends UrlEvent>(event: T): T {
  if (event.request?.url) event.request.url = redactTelemetryUrl(event.request.url);
  if (event.transaction) event.transaction = redactTelemetryUrl(event.transaction);
  for (const crumb of event.breadcrumbs ?? []) redactFields(crumb.data);
  for (const span of event.spans ?? []) {
    if (span.description) span.description = redactTelemetryUrl(span.description);
    redactFields(span.data);
  }
  return event;
}
function redactFields(fields: Record<string, unknown> | undefined) {
  if (!fields) return;
  for (const key of ["url", "to", "from", "http.url", "url.full", "url.original", "http.target"]) {
    const value = fields[key];
    if (typeof value === "string") fields[key] = redactTelemetryUrl(value);
  }
}

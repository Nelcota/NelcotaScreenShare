/** How a dependency of the app is doing, as the status page shows it. */
export type HealthState = "ok" | "attention" | "down";

export interface HealthCheck {
  state: HealthState;
  /** One short line for the card, in plain Portuguese and without secrets. */
  detail: string;
}

export const HEALTH_LABELS: Record<
  HealthState,
  { label: string; tone: "success" | "warning" | "danger" }
> = {
  ok: { label: "Funcionando", tone: "success" },
  attention: { label: "Atenção", tone: "warning" },
  down: { label: "Fora do ar", tone: "danger" },
};

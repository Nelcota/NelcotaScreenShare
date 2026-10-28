import { CircleCheck, CircleDashed, ShieldCheck } from "lucide-react";
import { Link } from "react-router";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { OpenRowLink } from "./OpenRowLink";

interface Step {
  done: boolean;
  title: string;
  description: string;
  action: ReactNode;
}

/**
 * What is missing for the account to be protected, with the action beside it. All
 * done: it collapses into a single line, taking no space.
 */
export function AccountHealth({
  emailVerified,
  emailRequired,
  twoFactorEnabled,
}: {
  emailVerified: boolean;
  /** The server requires a confirmed e-mail to join rooms. */
  emailRequired: boolean;
  twoFactorEnabled: boolean;
}) {
  const steps: Step[] = [
    {
      done: emailVerified,
      title: "Confirmar e-mail",
      description: emailRequired
        ? "Necessário para entrar em salas."
        : "Para recuperar a conta se você esquecer a senha.",
      action: (
        <Button asChild>
          <Link viewTransition to="/verificar-email?voltar=%2Fconta">
            Reenviar link
          </Link>
        </Button>
      ),
    },
    {
      done: twoFactorEnabled,
      title: "Ativar verificação em duas etapas",
      description: "Protege a conta mesmo se a senha vazar.",
      action: <OpenRowLink row="duas-etapas">Ativar</OpenRowLink>,
    },
  ];
  const done = steps.filter((step) => step.done).length;

  if (done === steps.length) {
    return (
      <p className="flex items-center gap-2.5 rounded-2xl border border-brand/25 bg-brand/8 px-5 py-4 text-sm">
        <ShieldCheck className="size-5 shrink-0 text-brand-soft" aria-hidden="true" />
        <span>
          <span className="font-medium">Conta protegida.</span>{" "}
          <span className="text-ink-muted">
            E-mail confirmado e verificação em duas etapas ativa.
          </span>
        </span>
      </p>
    );
  }

  return (
    <section
      aria-labelledby="saude-da-conta"
      className="rounded-2xl border border-warning/30 bg-surface p-5 @xl:p-6"
    >
      <div className="flex items-center justify-between gap-4">
        <h2 id="saude-da-conta" className="font-semibold tracking-[-0.01em]">
          Falta pouco para proteger sua conta
        </h2>
        <span className="shrink-0 text-xs text-ink-muted tabular-nums">
          {done} de {steps.length}
        </span>
      </div>
      <progress
        aria-label="Passos concluídos"
        value={done}
        max={steps.length}
        className="mt-3 block h-1.5 w-full appearance-none overflow-hidden rounded-full bg-surface-3 [&::-moz-progress-bar]:rounded-full [&::-moz-progress-bar]:bg-brand [&::-webkit-progress-bar]:bg-surface-3 [&::-webkit-progress-value]:rounded-full [&::-webkit-progress-value]:bg-brand"
      />
      <ul className="mt-4 flex flex-col divide-y divide-line">
        {steps.map((step) => (
          <li key={step.title} className="flex flex-wrap items-center gap-3 py-3 last:pb-0">
            {step.done ? (
              <CircleCheck className="size-5 shrink-0 text-brand-soft" aria-hidden="true" />
            ) : (
              <CircleDashed className="size-5 shrink-0 text-warning" aria-hidden="true" />
            )}
            <div className="min-w-0 flex-1">
              <p className={cn("text-sm font-medium", step.done && "text-ink-muted line-through")}>
                {step.title}
                <span className="sr-only">{step.done ? " (feito)" : " (pendente)"}</span>
              </p>
              {step.done ? null : <p className="text-xs text-ink-muted">{step.description}</p>}
            </div>
            {step.done ? null : step.action}
          </li>
        ))}
      </ul>
    </section>
  );
}

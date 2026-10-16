import { ShieldAlert, ShieldCheck } from "lucide-react";

function headerHint(enabled: boolean, required: boolean): string {
  if (enabled) {
    return "Ativa. Ao entrar, pedimos a senha e um código do app autenticador.";
  }
  if (required) return "Obrigatória para o seu papel. Ative para usar o painel.";
  return "Recomendada. Protege a conta mesmo se a senha vazar.";
}

export function TwoFactorHeader({
  titleId,
  enabled,
  required,
  verified,
}: {
  titleId: string;
  enabled: boolean;
  required: boolean;
  verified: boolean;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-surface-2">
        {enabled || verified ? (
          <ShieldCheck className="size-5 text-brand-soft" aria-hidden="true" />
        ) : (
          <ShieldAlert className="size-5 text-warning" aria-hidden="true" />
        )}
      </span>
      <div>
        <h2 id={titleId} className="text-lg font-semibold tracking-tight">
          Verificação em duas etapas
        </h2>
        <p className="text-sm text-ink-muted">{headerHint(enabled, required)}</p>
      </div>
    </div>
  );
}

import { useId } from "react";
import { FormError } from "@/components/FormError";
import { QrCode } from "@/components/QrCode";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTwoFactorSetup } from "@/features/security/hooks/use-two-factor-setup";
import { BackupCodes } from "./BackupCodes";
import {
  EnableTwoFactorForm,
  ManageTwoFactorForms,
  type SubmitHandler,
  type TwoFactorFormState,
} from "./TwoFactorForms";
import { TwoFactorHeader } from "./TwoFactorHeader";

export function TwoFactorSettings({
  scope,
  enabled,
  required,
  doneHref,
  variant = "card",
}: {
  /** Which Better Auth instance: admin panel or participant account. */
  scope: "admin" | "user";
  enabled: boolean;
  /** The role requires 2FA (owner/admin): it cannot be turned off. */
  required: boolean;
  /** Where to go after enabling. */
  doneHref: string;
  /** `plain`: no card or header; the caller already shows title and state. */
  variant?: "card" | "plain";
}) {
  const plain = variant === "plain";
  const passwordId = useId();
  const codeId = useId();
  const errorId = useId();
  const setup = useTwoFactorSetup({ scope, doneHref, codeId });
  const { step } = setup;
  const formState: TwoFactorFormState = {
    error: setup.error,
    pending: setup.pending,
    errorId,
    invalidField: setup.invalidField,
  };

  function stepContent() {
    if (step.name === "codes") {
      return (
        <BackupCodes
          scope={scope}
          codes={step.backupCodes}
          onDone={enabled ? setup.backToIdle : setup.finish}
        />
      );
    }
    if (step.name === "scan") {
      return (
        <VerifyCodeForm
          totpURI={step.totpURI}
          secret={step.secret}
          codeId={codeId}
          state={formState}
          onSubmit={setup.handleVerify}
        />
      );
    }
    if (enabled) {
      return (
        <ManageTwoFactorForms
          passwordId={passwordId}
          required={required}
          state={formState}
          onRegenerate={setup.handleRegenerate}
          onDisable={setup.handleDisable}
        />
      );
    }
    return (
      <EnableTwoFactorForm
        passwordId={passwordId}
        state={formState}
        onSubmit={setup.handleEnable}
      />
    );
  }

  return (
    <section
      className={plain ? "flex flex-col gap-5" : "panel flex flex-col gap-5 rounded-2xl p-6 sm:p-8"}
      aria-labelledby={plain ? undefined : `${codeId}-titulo`}
      aria-label={plain ? "Verificação em duas etapas" : undefined}
    >
      {plain ? null : (
        <TwoFactorHeader
          titleId={`${codeId}-titulo`}
          enabled={enabled}
          required={required}
          verified={step.name === "codes"}
        />
      )}

      {stepContent()}
    </section>
  );
}

function VerifyCodeForm({
  totpURI,
  secret,
  codeId,
  state,
  onSubmit,
}: {
  totpURI: string;
  secret: string;
  codeId: string;
  state: TwoFactorFormState;
  onSubmit: SubmitHandler;
}) {
  return (
    <form
      method="post"
      noValidate
      onSubmit={(event) => void onSubmit(event)}
      className="flex flex-col gap-4"
    >
      <ScanInstructions totpURI={totpURI} secret={secret} />
      <div className="flex flex-col gap-2 sm:max-w-xs">
        <Label htmlFor={codeId}>Código do app</Label>
        <Input
          id={codeId}
          name="code"
          aria-invalid={state.invalidField === codeId}
          aria-describedby={state.errorId}
          required
          autoFocus
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          className="h-12 text-center text-lg font-semibold tracking-[0.3em]"
        />
      </div>
      <FormError id={state.errorId} message={state.error} />
      <Button type="submit" loading={state.pending} className="sm:self-start">
        Confirmar e ativar
      </Button>
    </form>
  );
}

function ScanInstructions({ totpURI, secret }: { totpURI: string; secret: string }) {
  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
      <QrCode value={totpURI} label="QR code para o app autenticador" />
      <div className="flex flex-col gap-2 text-sm text-ink-muted">
        <p>
          1. Abra um app autenticador (Google Authenticator, Microsoft Authenticator, 1Password,
          Bitwarden…) e escaneie o QR code.
        </p>
        <p>2. Sem câmera? Digite a chave:</p>
        <code className="rounded-lg bg-surface-2 px-2 py-1.5 font-sans text-xs break-all text-ink tabular-nums">
          {secret}
        </code>
        <p>3. Digite o código de 6 dígitos que aparecer no app.</p>
      </div>
    </div>
  );
}

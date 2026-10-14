import { Link } from "react-router";
import { Loader2 } from "lucide-react";

import { useOperation } from "@/lib/operations/use-operation";
import { useId, useState } from "react";
import { deleteMyAccount } from "@/features/account/actions";
import { FormError } from "@/components/FormError";
import { PasswordInput } from "@/components/PasswordInput";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formText } from "@/lib/utils";
import { useCloseRow } from "./settings/ExpandableRow";

/**
 * Account deletion confirmation (LGPD): asks for the current password and, with two-step
 * verification on, a code from the authenticator app or a backup code.
 */
export function DeleteAccountForm({
  ownedTeamCount = 0,
  askCode = false,
}: {
  ownedTeamCount?: number;
  askCode?: boolean;
}) {
  const passwordId = useId();
  const codeId = useId();
  const errorId = useId();
  const closeRow = useCloseRow();
  const [passwordError, setPasswordError] = useState<string>();
  const remove = useOperation(deleteMyAccount);
  const error = passwordError ?? remove.result.serverError;

  return (
    <form
      method="post"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        const password = formText(data, "password");
        if (!password) {
          setPasswordError("Informe sua senha para confirmar.");
          event.currentTarget.querySelector<HTMLInputElement>("input[name=password]")?.focus();
          return;
        }
        const code = askCode ? formText(data, "code") : undefined;
        if (askCode && !code) {
          setPasswordError("Digite o código de duas etapas para confirmar.");
          event.currentTarget.querySelector<HTMLInputElement>("input[name=code]")?.focus();
          return;
        }
        setPasswordError(undefined);
        remove.execute({ password, code, deleteOwnedTeams: data.get("deleteTeams") === "on" });
      }}
      className="flex max-w-sm flex-col gap-3"
    >
      <div className="flex flex-col gap-2">
        <Label htmlFor={passwordId}>Digite sua senha para confirmar</Label>
        <PasswordInput
          id={passwordId}
          name="password"
          autoComplete="current-password"
          required
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          onChange={() => setPasswordError(undefined)}
        />
      </div>
      {askCode ? (
        <div className="flex flex-col gap-2">
          <Label htmlFor={codeId}>Código de duas etapas</Label>
          <Input
            id={codeId}
            name="code"
            autoComplete="one-time-code"
            spellCheck={false}
            required
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
            onChange={() => setPasswordError(undefined)}
          />
          <p className="text-sm text-ink-muted">Do app autenticador, ou um código de backup.</p>
        </div>
      ) : null}
      {ownedTeamCount ? (
        <div className="flex flex-col gap-3 rounded-xl border border-danger/30 p-3 text-sm">
          <p>
            Você é dono de {ownedTeamCount} time(s).{" "}
            <Link className="underline" to="/times">
              Transfira a propriedade
            </Link>{" "}
            para manter esses times.
          </p>
          <label className="flex items-start gap-2">
            <input type="checkbox" name="deleteTeams" className="mt-1" />
            <span>Excluir também meus times, encerrar suas chamadas e arquivar suas salas.</span>
          </label>
        </div>
      ) : null}
      <FormError id={errorId} message={error} />
      <div className="flex flex-wrap gap-2">
        <Button
          type="submit"
          variant="destructive"
          disabled={remove.isPending}
          className="h-auto! min-h-10 max-w-full py-2 whitespace-normal"
        >
          {remove.isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
          Excluir minha conta para sempre
        </Button>
        {closeRow ? (
          <Button
            type="button"
            variant="ghost"
            onClick={(event) => {
              event.currentTarget.form?.reset();
              setPasswordError(undefined);
              closeRow();
            }}
          >
            Cancelar
          </Button>
        ) : null}
      </div>
    </form>
  );
}

import { useId, useState } from "react";
import { FormError } from "@/components/FormError";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { formText } from "@/lib/utils";
import { useOperation } from "@/lib/operations/use-operation";
import { provisionBetaAction } from "../actions";
import type { betaSubjects } from "../server/queries.server";

type Subjects = Awaited<ReturnType<typeof betaSubjects>>;
export function ProvisionForm({ subjects, canEdit }: { subjects: Subjects; canEdit: boolean }) {
  const prefix = useId();
  const [subject, setSubject] = useState<"account" | "team">("account");
  const [selected, setSelected] = useState("");
  const rows = subject === "account" ? subjects.accounts : subjects.teams;
  const current = rows.find((row) => row.id === selected);
  const action = useOperation(provisionBetaAction);
  return (
    <div className="flex flex-col gap-6">
      <form method="get" className="flex max-w-lg gap-2">
        <Input
          name="busca"
          aria-label="Buscar contas e times"
          placeholder="Nome ou e-mail"
          maxLength={100}
        />
        <Button type="submit" variant="outline">
          Buscar
        </Button>
      </form>
      <p className="text-sm text-ink-muted">
        Até 100 contas e 100 times por busca. Contas e times têm ativações independentes; o piloto
        não cria cobranças.
      </p>
      <form
        className="flex max-w-lg flex-col gap-4 rounded-2xl border border-line bg-surface p-5"
        onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          const expiry = formText(data, "expiry");
          action.execute({
            subject,
            id: selected,
            active: data.get("active") === "on",
            roomLimit: Number(formText(data, "limit")),
            expiresAt: expiry ? new Date(`${expiry}T23:59:59-03:00`).toISOString() : null,
            reason: formText(data, "reason"),
          });
        }}
      >
        <div className="flex flex-col gap-2">
          <Label htmlFor={`${prefix}-subject`}>Titular</Label>
          <select
            id={`${prefix}-subject`}
            className="rounded-xl border border-line bg-surface-2 p-3"
            value={subject}
            onChange={(event) => {
              setSubject(event.target.value === "team" ? "team" : "account");
              setSelected("");
            }}
          >
            <option value="account">Conta pessoal</option>
            <option value="team">Time</option>
          </select>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor={`${prefix}-id`}>Conta ou time</Label>
          <select
            id={`${prefix}-id`}
            required
            className="rounded-xl border border-line bg-surface-2 p-3"
            value={selected}
            onChange={(event) => setSelected(event.target.value)}
          >
            <option value="">Selecione</option>
            {rows.map((row) => (
              <option key={row.id} value={row.id}>
                {row.name}
                {"email" in row && typeof row.email === "string" ? ` · ${row.email}` : ""}
              </option>
            ))}
          </select>
        </div>
        <fieldset
          key={`${subject}/${selected}/${String(current?.pro?.updatedAt ?? "")}`}
          disabled={!canEdit || action.isPending}
          className="flex flex-col gap-4"
        >
          <legend className="sr-only">Ativação Pro beta</legend>
          <label className="flex gap-3 text-sm">
            <input name="active" type="checkbox" defaultChecked={current?.pro?.active ?? true} />
            Ativação vigente
          </label>
          <div className="flex flex-col gap-2">
            <Label htmlFor={`${prefix}-limit`}>Limite de salas permanentes</Label>
            <Input
              id={`${prefix}-limit`}
              name="limit"
              type="number"
              min={1}
              max={50}
              required
              defaultValue={initialLimit(current?.pro)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor={`${prefix}-expiry`}>Expiração (opcional, horário de Brasília)</Label>
            <Input
              id={`${prefix}-expiry`}
              name="expiry"
              type="date"
              defaultValue={
                current?.pro?.expiresAt
                  ? new Date(current.pro.expiresAt).toLocaleDateString("en-CA", {
                      timeZone: "America/Sao_Paulo",
                    })
                  : ""
              }
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor={`${prefix}-reason`}>Motivo da alteração</Label>
            <Input id={`${prefix}-reason`} name="reason" minLength={3} maxLength={300} required />
          </div>
          <Button type="submit" disabled={!selected}>
            Salvar ativação
          </Button>
        </fieldset>
        <FormError message={action.result.serverError} />
        {action.result.data ? (
          <output className="text-sm text-brand-soft">
            Ativação salva e registrada na auditoria.
          </output>
        ) : null}
      </form>
    </div>
  );
}

function initialLimit(pro: { roomLimit: number } | null | undefined) {
  return pro?.roomLimit ?? 3;
}

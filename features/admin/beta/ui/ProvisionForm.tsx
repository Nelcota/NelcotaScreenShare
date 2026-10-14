import { useId, useState } from "react";
import { ChoiceSelect } from "@/components/ChoiceSelect";
import { FilterDate } from "@/components/data-table/filters";
import { FormError } from "@/components/FormError";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formText } from "@/lib/utils";
import { useOperation } from "@/lib/operations/use-operation";
import { provisionBetaAction } from "../actions";
import type { betaSubjects } from "../server/queries.server";

type Subjects = Awaited<ReturnType<typeof betaSubjects>>;
type Subject = "account" | "team";
type Row = Subjects["accounts"][number] | Subjects["teams"][number];
type Pro = Row["pro"];

const SUBJECT_OPTIONS = [
  { value: "account", label: "Conta pessoal" },
  { value: "team", label: "Time" },
] as const;

const MAX_ROOMS = 50;

function rowLabel(row: Row): string {
  return "email" in row && typeof row.email === "string" ? `${row.name} · ${row.email}` : row.name;
}

/** The expiry as a São Paulo day (YYYY-MM-DD), the value the date field works with. */
function expiryDay(pro: Pro): string | null {
  if (!pro?.expiresAt) return null;
  return new Date(pro.expiresAt).toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

/** What is wrong with the form, checked before sending (the server checks again). */
function formProblem({
  selected,
  limit,
  reason,
}: {
  selected: string;
  limit: number;
  reason: string;
}): string | null {
  if (!selected) return "Escolha a conta ou o time.";
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_ROOMS) {
    return `O limite vai de 1 a ${MAX_ROOMS} salas.`;
  }
  if (reason.trim().length < 3) return "Escreva o motivo da alteração.";
  return null;
}

function SearchForm() {
  return (
    <form method="get" noValidate className="flex max-w-lg gap-2">
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
  );
}

/** Active, room limit, expiry and reason; remounted (fresh values) for each subject. */
function ActivationFields({
  prefix,
  pro,
  active,
  onActiveChange,
  expiry,
  onExpiryChange,
}: {
  prefix: string;
  pro: Pro;
  active: boolean;
  onActiveChange: (active: boolean) => void;
  expiry: string | null;
  onExpiryChange: (expiry: string | null) => void;
}) {
  return (
    <>
      <div className="flex items-center gap-3 text-sm">
        <Checkbox
          id={`${prefix}-active`}
          checked={active}
          onCheckedChange={(value) => onActiveChange(value === true)}
        />
        <Label htmlFor={`${prefix}-active`} className="font-normal">
          Ativação vigente
        </Label>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor={`${prefix}-limit`}>Limite de salas permanentes</Label>
        <Input
          id={`${prefix}-limit`}
          name="limit"
          type="number"
          min={1}
          max={MAX_ROOMS}
          defaultValue={pro?.roomLimit ?? 3}
        />
      </div>
      <FilterDate
        form
        label="Expiração (opcional, horário de Brasília)"
        value={expiry}
        onChange={onExpiryChange}
      />
      <div className="flex flex-col gap-2">
        <Label htmlFor={`${prefix}-reason`}>Motivo da alteração</Label>
        <Input id={`${prefix}-reason`} name="reason" maxLength={300} />
      </div>
    </>
  );
}

function ProvisionFields({
  rows,
  subject,
  selected,
  canEdit,
}: {
  rows: Row[];
  subject: Subject;
  selected: string;
  canEdit: boolean;
}) {
  const prefix = useId();
  const current = rows.find((row) => row.id === selected);
  const [active, setActive] = useState(current?.pro?.active ?? true);
  const [expiry, setExpiry] = useState(expiryDay(current?.pro ?? null));
  const [problem, setProblem] = useState<string | null>(null);
  const action = useOperation(provisionBetaAction);

  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        const limit = Number(formText(data, "limit"));
        const reason = formText(data, "reason");
        const found = formProblem({ selected, limit, reason });
        setProblem(found);
        if (found) return;
        action.execute({
          subject,
          id: selected,
          active,
          roomLimit: limit,
          expiresAt: expiry ? new Date(`${expiry}T23:59:59-03:00`).toISOString() : null,
          reason,
        });
      }}
    >
      <fieldset disabled={!canEdit || action.isPending} className="flex flex-col gap-4">
        <legend className="sr-only">Ativação Pro beta</legend>
        <ActivationFields
          prefix={prefix}
          pro={current?.pro ?? null}
          active={active}
          onActiveChange={setActive}
          expiry={expiry}
          onExpiryChange={setExpiry}
        />
        <Button type="submit">Salvar ativação</Button>
      </fieldset>
      <FormError message={problem ?? action.result.serverError} />
      {action.result.data && !problem ? (
        <output className="text-sm text-brand-soft">
          Ativação salva e registrada na auditoria.
        </output>
      ) : null}
    </form>
  );
}

export function ProvisionForm({ subjects, canEdit }: { subjects: Subjects; canEdit: boolean }) {
  const prefix = useId();
  const [subject, setSubject] = useState<Subject>("account");
  const [selected, setSelected] = useState("");
  const rows: Row[] = subject === "account" ? subjects.accounts : subjects.teams;
  const current = rows.find((row) => row.id === selected);
  return (
    <div className="flex flex-col gap-6">
      <SearchForm />
      <p className="text-sm text-ink-muted">
        Até 100 contas e 100 times por busca. Contas e times têm ativações independentes; o piloto
        não cria cobranças.
      </p>
      <div className="flex max-w-lg flex-col gap-4 rounded-2xl border border-line bg-surface p-5">
        <div className="flex flex-col gap-2">
          <Label htmlFor={`${prefix}-subject`}>Titular</Label>
          <ChoiceSelect
            id={`${prefix}-subject`}
            className="h-11 w-full bg-surface-2"
            value={subject}
            options={SUBJECT_OPTIONS}
            onValueChange={(value) => {
              setSubject(value === "team" ? "team" : "account");
              setSelected("");
            }}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor={`${prefix}-id`}>Conta ou time</Label>
          <ChoiceSelect
            id={`${prefix}-id`}
            className="h-11 w-full bg-surface-2"
            value={selected}
            options={[
              { value: "", label: "Selecione" },
              ...rows.map((row) => ({ value: row.id, label: rowLabel(row) })),
            ]}
            onValueChange={setSelected}
          />
        </div>
        <ProvisionFields
          key={`${subject}/${selected}/${String(current?.pro?.updatedAt ?? "")}`}
          rows={rows}
          subject={subject}
          selected={selected}
          canEdit={canEdit}
        />
      </div>
    </div>
  );
}

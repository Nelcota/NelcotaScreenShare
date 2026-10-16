import { useEffect, useId, useRef, useState } from "react";
import { InitialsAvatar } from "@/components/InitialsAvatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { callAuth } from "@/features/auth/client/auth-call";
import { authClient } from "@/features/auth/client/participant-auth-client";
import { displayNameSchema } from "@/features/room/domain/participant-label";

/** Edits the account name without leaving the pre-join screen. */
export function NameRow({
  name,
  image,
  onChange,
}: {
  name: string;
  image: string | null;
  onChange: (name: string) => void;
}) {
  const inputId = useId();
  const errorId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);

  // Editing opened: the field comes pre-selected to type over.
  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  async function save() {
    const parsed = displayNameSchema.safeParse(draft);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Confira o nome.");
      inputRef.current?.focus();
      return;
    }
    if (parsed.data === name) {
      setEditing(false);
      return;
    }
    setSaving(true);
    const { error: failure } = await callAuth(() => authClient.updateUser({ name: parsed.data }));
    setSaving(false);
    if (failure) {
      setError("Não foi possível salvar o nome. Tente de novo.");
      return;
    }
    onChange(parsed.data);
    setEditing(false);
  }

  if (editing) {
    return (
      <div className="flex flex-col gap-2 px-4 py-3">
        <label htmlFor={inputId} className="text-sm text-ink-muted">
          Seu nome na sala
        </label>
        <div className="flex flex-wrap items-center justify-end gap-2 sm:flex-nowrap">
          <Input
            ref={inputRef}
            id={inputId}
            value={draft}
            maxLength={32}
            autoComplete="name"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
            onChange={(event) => {
              setDraft(event.target.value);
              setError(undefined);
            }}
            onKeyDown={(event) => {
              // Enter saves the name (does not submit the room form); Esc cancels.
              if (event.key === "Enter") {
                event.preventDefault();
                void save();
                return;
              }
              if (event.key === "Escape") {
                setDraft(name);
                setEditing(false);
              }
            }}
            className="flex-none rounded-full border-line px-4 text-lg text-ink sm:w-auto sm:flex-1"
          />
          <Button type="button" size="default" loading={saving} onClick={() => void save()}>
            Salvar
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="default"
            onClick={() => {
              setDraft(name);
              setError(undefined);
              setEditing(false);
            }}
          >
            Cancelar
          </Button>
        </div>
        {error ? (
          <p id={errorId} role="alert" className="text-base text-danger">
            {error}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <InitialsAvatar
        name={name}
        source={image}
        className="size-10 shrink-0 bg-brand/15 text-sm font-medium text-brand-soft"
      />
      <p className="min-w-0 flex-1">
        <span className="block text-sm text-ink-muted">Você vai entrar como</span>
        <strong className="block truncate text-lg font-medium">{name}</strong>
      </p>
      <button
        type="button"
        onClick={() => {
          setDraft(name);
          setEditing(true);
        }}
        className="-mr-2 shrink-0 rounded-lg px-2 py-1.5 text-sm font-medium text-brand-soft transition-colors hover:bg-surface-2 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        {/* On phones just "Mudar": with "nome", the text beside it wrapped the line. */}
        Mudar<span className="max-sm:sr-only"> nome</span>
      </button>
    </div>
  );
}

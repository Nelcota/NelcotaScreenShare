import { Loader2 } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { callAuth } from "@/features/auth/client/auth-call";
import { authClient } from "@/features/auth/client/participant-auth-client";
import { displayNameSchema } from "@/features/room/domain/participant-label";
import { initials } from "@/lib/initials";

/** The account photo; without one (or if it fails to load), the name's initials. */
function AccountPicture({ name, image }: { name: string; image: string | null }) {
  const [failedImage, setFailedImage] = useState<string | null>(null);
  if (image && image !== failedImage) {
    return (
      <img
        key={image}
        src={image}
        alt=""
        aria-hidden="true"
        referrerPolicy="no-referrer"
        ref={(element) => {
          // The SSR image may have failed before hydration installed onError.
          if (!element?.complete || element.naturalWidth > 0) return;
          setFailedImage(image);
        }}
        onError={() => setFailedImage(image)}
        className="size-10 shrink-0 rounded-full object-cover"
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className="grid size-10 shrink-0 place-items-center rounded-full bg-brand/15 text-sm font-medium text-brand-soft"
    >
      {initials(name)}
    </span>
  );
}

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
          <input
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
            data-slot="input"
            className="h-11 w-full min-w-0 flex-none rounded-full border border-line bg-surface-2 px-4 text-lg text-ink outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 sm:w-auto sm:flex-1"
          />
          <Button type="button" size="default" disabled={saving} onClick={() => void save()}>
            {saving ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
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
      <AccountPicture name={name} image={image} />
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

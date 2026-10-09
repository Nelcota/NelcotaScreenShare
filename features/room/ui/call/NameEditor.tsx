import { useLocalParticipant } from "@livekit/components-react";
import { ArrowRight, Loader2 } from "lucide-react";
import { useId, useState, type FormEvent } from "react";
import { Link, useRevalidator } from "react-router";
import { toast } from "sonner";
import { FormError } from "@/components/FormError";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { renameInRoom } from "@/features/room/client/api";
import { displayNameSchema, isGuestIdentity } from "@/features/room/domain/participant-label";
import { roomPath } from "@/features/room/domain/room-code";
import { rememberName } from "@/features/room/hooks/use-guest-name";
import { formText } from "@/lib/utils";

/**
 * Your name in the call, editable without leaving it: everyone sees the new one at once.
 * An account also keeps it (and links to the full profile, with the call minimized); a
 * guest's stays in this browser for the next invite.
 */
export function NameEditor({ code }: { code: string }) {
  const { localParticipant } = useLocalParticipant();
  const revalidator = useRevalidator();
  const nameId = useId();
  const guest = isGuestIdentity(localParticipant.identity);
  const current = localParticipant.name ?? "";
  const [draft, setDraft] = useState<string>();
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);
  const value = draft ?? current;
  const unchanged = value.trim() === current;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = displayNameSchema.safeParse(formText(new FormData(event.currentTarget), "name"));
    if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? "Confira seu nome.");
    setPending(true);
    setError(undefined);
    const result = await renameInRoom(code, parsed.data);
    setPending(false);
    if (!result.ok) return setError(result.message);
    setDraft(undefined);
    toast.success("Nome atualizado para todos na sala.");
    if (guest) return rememberName(result.name);
    // The header and other pages read the account's name from the loaders.
    void revalidator.revalidate();
  }

  return (
    <form
      method="post"
      onSubmit={(event) => void handleSubmit(event)}
      noValidate
      className="flex flex-col gap-2"
    >
      <Label htmlFor={nameId} className="text-base font-medium">
        Seu nome na sala
      </Label>
      <div className="flex gap-2">
        <Input
          id={nameId}
          name="name"
          value={value}
          onChange={(event) => {
            setDraft(event.target.value);
            setError(undefined);
          }}
          maxLength={32}
          required
          autoComplete="name"
          aria-invalid={error ? true : undefined}
          className="h-10 min-w-0 flex-1"
        />
        <Button type="submit" disabled={pending || unchanged}>
          {pending ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
          Salvar
        </Button>
      </div>
      <FormError message={error} />
      {guest ? (
        <p className="text-sm text-ink-muted">
          Vale para esta chamada e para os próximos convites.
        </p>
      ) : (
        <Link
          viewTransition
          to={`/conta?voltar=${encodeURIComponent(roomPath(code))}`}
          className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-brand-soft underline-offset-4 hover:underline"
        >
          Foto, e-mail e senha na sua conta (a chamada continua)
          <ArrowRight className="icon-nudge size-4" aria-hidden="true" />
        </Link>
      )}
    </form>
  );
}

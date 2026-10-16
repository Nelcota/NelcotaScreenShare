import { Copy, RefreshCw, UserPlus } from "lucide-react";
import { useId, useState, type FormEvent } from "react";
import { useRouteLoaderData } from "react-router";
import { toast } from "sonner";
import type { loader as rootLoader } from "@/app/root";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { addFriend, newFriendCode } from "@/features/friends/actions";
import { copyText } from "@/lib/clipboard";
import { useOperation } from "@/lib/operations/use-operation";

/** Your code, big enough to read aloud, with a copy button. */
function OwnCode({ code }: { code: string }) {
  return (
    <div className="rounded-2xl bg-surface-2 p-4 text-center">
      <p className="text-sm text-ink-muted">Seu código</p>
      <p className="mt-1 font-mono text-3xl font-semibold tracking-widest">{code}</p>
      <Button
        className="mt-3"
        onClick={() =>
          void copyText(code, {
            context: "Could not copy the friend code",
            success: "Código copiado.",
            failure: "Não foi possível copiar. Anote o código.",
          })
        }
      >
        <Copy aria-hidden="true" />
        Copiar
      </Button>
    </div>
  );
}

const SENT: Record<"sent" | "friends", string> = {
  sent: "Pedido enviado.",
  friends: "Vocês agora são amigos.",
};

/** The other person's e-mail or code. */
function AddForm() {
  const fieldId = useId();
  const [value, setValue] = useState("");
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const add = useOperation(addFriend, {
    onSuccess: ({ data }) => {
      setValue("");
      setMessage({ text: SENT[data.status], ok: true });
    },
    onError: ({ error }) =>
      setMessage({ text: error.serverError ?? "Não foi possível agora.", ok: false }),
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const target = value.trim();
    if (!target) return;
    setMessage(null);
    add.execute({ target });
  }

  return (
    <form onSubmit={submit} className="flex flex-col">
      <label htmlFor={fieldId} className="text-sm font-medium">
        E-mail ou código da pessoa
      </label>
      <div className="mt-2 flex gap-2">
        <Input
          id={fieldId}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="NELC-XXXXXX ou e-mail"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          maxLength={254}
          className="min-w-0 flex-1"
        />
        <Button type="submit" disabled={add.isPending || !value.trim()}>
          <UserPlus aria-hidden="true" />
          Enviar
        </Button>
      </div>
      {message ? (
        <output className={message.ok ? "mt-2 text-sm text-success" : "mt-2 text-sm text-danger"}>
          {message.text}
        </output>
      ) : null}
    </form>
  );
}

/** "Convidar por link" copies the link without showing it; it only shows when copying fails. */
function LinkActions({ linkPath }: { linkPath: string }) {
  const origin = useRouteLoaderData<typeof rootLoader>("root")?.origin ?? "";
  const link = `${origin}${linkPath}`;
  const [copyFailed, setCopyFailed] = useState(false);
  const rotate = useOperation(newFriendCode, {
    onSuccess: () => toast.success("Código e link novos. Os anteriores pararam de funcionar."),
    onError: () => toast.error("Não foi possível trocar o código agora."),
  });

  async function copyLink() {
    const copied = await copyText(link, {
      context: "Could not copy the friend link",
      success: "Link copiado. Mande para quem você quer adicionar.",
      failure: "Não foi possível copiar. Copie o link abaixo.",
    });
    setCopyFailed(!copied);
  }

  return (
    <div className="border-t border-line pt-4">
      <div className="flex flex-wrap gap-2">
        <Button variant="ghost" onClick={() => void copyLink()}>
          <Copy aria-hidden="true" />
          Convidar por link
        </Button>
        <Button variant="ghost" disabled={rotate.isPending} onClick={() => rotate.execute()}>
          <RefreshCw aria-hidden="true" />
          Gerar novo código
        </Button>
      </div>
      {copyFailed ? (
        <Input
          readOnly
          value={link}
          aria-label="Seu link de amigo"
          onFocus={(event) => event.currentTarget.select()}
          className="mt-3 font-mono text-sm"
        />
      ) : null}
    </div>
  );
}

/** Adding friends: your code to hand out, the field for theirs, and the hidden link. */
export function AddFriendPanel({ code, linkPath }: { code: string; linkPath: string }) {
  return (
    <div className="flex flex-col gap-5">
      <OwnCode code={code} />
      <AddForm />
      <LinkActions linkPath={linkPath} />
    </div>
  );
}

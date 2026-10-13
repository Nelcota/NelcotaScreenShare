import { UserPlus } from "lucide-react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/UserAvatar";
import { sendFriendRequest } from "@/features/friends/actions";
import type { FriendRelation } from "@/features/friends/domain/friend-lists";
import type { FriendInvite } from "@/features/friends/server/friend-invite.server";
import { useOperation } from "@/lib/operations/use-operation";

const REQUESTS_PATH = "/amigos/pedidos";

/** What the invite says when it cannot be accepted with a click. */
const RELATION_LINE: Partial<Record<FriendRelation, string>> = {
  self: "Este é o seu link. Mande para quem você quer adicionar.",
  friends: "Vocês já são amigos",
  sent: "Pedido enviado",
  received: "Já te mandou um pedido. Aceite em Recebidos.",
  blocked: "Você bloqueou essa pessoa. Desbloqueie abaixo para adicionar.",
};

function IgnoreButton() {
  const navigate = useNavigate();
  return (
    <Button
      size="sm"
      variant="outline"
      onClick={() => void navigate(REQUESTS_PATH, { replace: true, viewTransition: true })}
    >
      Ignorar
    </Button>
  );
}

function AddButton({ personId }: { personId: string }) {
  const send = useOperation(sendFriendRequest, {
    onError: ({ error }) => toast.error(error.serverError ?? "Não foi possível agora."),
  });
  return (
    <Button size="sm" disabled={send.isPending} onClick={() => send.execute({ userId: personId })}>
      <UserPlus aria-hidden="true" />
      Adicionar
    </Button>
  );
}

function InviteRow({ invite }: { invite: FriendInvite }) {
  if (invite.status === "expired") {
    return (
      <div className="flex flex-wrap items-center gap-3 py-2">
        <p className="min-w-0 flex-1 text-sm text-ink-muted">
          Este link não funciona mais. Peça um link novo.
        </p>
        <IgnoreButton />
      </div>
    );
  }
  const { person, relation } = invite;
  const line = RELATION_LINE[relation];
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <UserAvatar image={person.image} className="size-10 shrink-0" />
      <p className="min-w-0 flex-1 basis-40">
        <span className="block truncate text-base font-medium">{person.name}</span>
        <span className="block text-sm text-ink-muted">{line ?? "te convidou"}</span>
      </p>
      <span className="flex shrink-0 items-center gap-2 max-sm:w-full max-sm:pl-13">
        {line ? null : <AddButton personId={person.id} />}
        <IgnoreButton />
      </span>
    </div>
  );
}

/** A friend link someone opened, on top of the requests, until added or ignored. */
export function InviteItem({ invite }: { invite: FriendInvite }) {
  return (
    <section aria-label="Convite" className="flex flex-col">
      <h2 className="text-sm font-medium text-ink-muted">Convite</h2>
      <div className="mt-2 rounded-2xl border border-brand/30 bg-brand/8 p-3">
        <InviteRow invite={invite} />
      </div>
    </section>
  );
}

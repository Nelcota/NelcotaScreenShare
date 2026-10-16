import { redirect, useLoaderData, useNavigate } from "react-router";
import { z } from "zod";
import { BackLink } from "@/components/shell/BackLink";
import { PanelClose } from "@/features/friends/ui/PanelClose";
import { requireUser } from "@/features/auth/server/participant-session.server";
import { friendCard } from "@/features/friends/server/friend-list.server";
import { shownStatuses } from "@/features/friends/server/presence-status.server";
import { FriendAvatar, presenceLabel } from "@/features/friends/ui/FriendAvatar";
import { FriendMenu } from "@/features/friends/ui/FriendMenu";
import { CallButton } from "@/features/ringing/ui/CallButton";
import { getDb } from "@/server/db/index.server";
import { routeLoader } from "@/server/route-loader.server";

export const meta = () => [{ title: "Amigo · Nelcota" }, { name: "robots", content: "noindex" }];

const SINCE = new Intl.DateTimeFormat("pt-BR", {
  month: "long",
  year: "numeric",
  timeZone: "America/Sao_Paulo",
});

export const loader = routeLoader(async ({ params }) => {
  const friendId = z.uuid().safeParse(params.id);
  const current = await requireUser(`/amigos/${params.id ?? ""}`);
  if (!friendId.success) throw redirect("/amigos");
  const card = await friendCard(getDb(), current.user.id, friendId.data);
  if (!card) throw redirect("/amigos");
  return {
    friend: {
      id: card.id,
      name: card.name,
      status: (await shownStatuses(getDb(), [card.id])).get(card.id) ?? ("offline" as const),
    },
    since: SINCE.format(card.since),
  };
});

/** A friend's card: photo, name, whether they are online, and the "…" menu. */
export default function FriendPage() {
  const { friend, since } = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  return (
    <div className="relative flex min-h-full flex-col items-center px-4 py-6 sm:py-16">
      <PanelClose className="absolute top-3 right-3" />
      <BackLink to="/amigos" className="mb-4 self-start sm:hidden">
        Amigos
      </BackLink>
      <section
        aria-label={friend.name}
        className="flex w-full max-w-md flex-col items-center rounded-3xl border border-line bg-surface-2 px-6 py-10 text-center"
      >
        <FriendAvatar
          friend={friend}
          size="size-28 text-3xl"
          dot="size-6 right-1.5 bottom-1.5 ring-4"
        />
        <h1 className="mt-4 text-2xl font-semibold tracking-tight">{friend.name}</h1>
        <p className="mt-1 text-sm text-ink-muted">{presenceLabel(friend)}</p>
        <div className="mt-6 flex items-center gap-2">
          <CallButton friend={friend} className="h-9 px-4" />
          <FriendMenu
            person={friend}
            size="icon"
            onDone={() => void navigate("/amigos", { replace: true, viewTransition: true })}
          />
        </div>
        <p className="mt-8 text-sm text-ink-subtle">Amigos desde {since}</p>
      </section>
    </div>
  );
}

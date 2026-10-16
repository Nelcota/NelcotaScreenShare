import type { ReactNode } from "react";
import { useLoaderData } from "react-router";
import { BackLink } from "@/components/shell/BackLink";
import { PanelClose } from "@/features/friends/ui/PanelClose";
import { requireUser } from "@/features/auth/server/participant-session.server";
import type { FriendPerson } from "@/features/friends/domain/friend-lists";
import { friendInvite } from "@/features/friends/server/friend-invite.server";
import { friendLists } from "@/features/friends/server/friend-list.server";
import { InviteItem } from "@/features/friends/ui/InviteItem";
import { BlockedRow, ReceivedRow, SentRow } from "@/features/friends/ui/FriendRows";
import { getDb } from "@/server/db/index.server";
import { pageUrl } from "@/server/page-url.server";
import { routeLoader } from "@/server/route-loader.server";

export const meta = () => [
  { title: "Pedidos de amizade · Nelcota" },
  { name: "robots", content: "noindex" },
];

export const loader = routeLoader(async ({ request, searchParams }) => {
  const url = pageUrl(request);
  const current = await requireUser(url.pathname + url.search);
  const db = getDb();
  const token = searchParams.convite;
  const [lists, invite] = await Promise.all([
    friendLists(db, current.user.id),
    token ? friendInvite(db, current.user.id, token) : null,
  ]);
  const { received, sent, blocked } = lists;
  return { received, sent, blocked, invite };
});

function PeopleSection({
  title,
  people,
  Row,
}: {
  title: string;
  people: FriendPerson[];
  Row: (props: { person: FriendPerson }) => ReactNode;
}) {
  if (people.length === 0) return null;
  return (
    <section className="flex flex-col">
      <h2 className="text-sm font-medium text-ink-muted">{title}</h2>
      <ul className="mt-1 divide-y divide-line">
        {people.map((person) => (
          <Row key={person.id} person={person} />
        ))}
      </ul>
    </section>
  );
}

/** Requests received and sent, and the people you blocked. */
export default function FriendsPage() {
  const { received, sent, blocked, invite } = useLoaderData<typeof loader>();
  const nothing = !invite && received.length === 0 && sent.length === 0 && blocked.length === 0;
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 py-6 sm:px-6 sm:py-8">
      <BackLink to="/amigos" className="-mb-4 sm:hidden">
        Amigos
      </BackLink>
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Pedidos de amizade</h1>
        <PanelClose className="-mr-2" />
      </div>
      {invite ? <InviteItem invite={invite} /> : null}
      <PeopleSection title="Recebidos" people={received} Row={ReceivedRow} />
      <PeopleSection title="Pedidos enviados" people={sent} Row={SentRow} />
      <PeopleSection title="Bloqueados" people={blocked} Row={BlockedRow} />
      {nothing ? <p className="text-base text-ink-muted">Nenhum pedido agora.</p> : null}
    </div>
  );
}

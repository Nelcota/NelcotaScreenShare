import { data, Link, useLoaderData } from "react-router";
import { NavBar, NavBrand } from "@/components/shell/NavBar";
import { ThemeToggle } from "@/components/shell/ThemeToggle";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/UserAvatar";
import { getUserSession } from "@/features/auth/server/participant-session.server";
import { friendLinkPath } from "@/features/friends/domain/friend-link";
import { friendInvite } from "@/features/friends/server/friend-invite.server";
import { getDb } from "@/server/db/index.server";
import { redirect } from "@/server/http.server";
import { routeLoader } from "@/server/route-loader.server";

export const meta = () => [
  { title: "Convite de amizade · Nelcota" },
  { name: "robots", content: "noindex" },
];

/**
 * A friend link. Signed in, it opens the requests panel with the invite on top (or the
 * friend's card when you are already friends). Signed out, a small card asks to sign in.
 */
export const loader = routeLoader(async ({ params }) => {
  const token = params.token ?? "";
  const current = await getUserSession();
  const invite = await friendInvite(getDb(), current?.user.id ?? null, token);
  if (current && invite.status === "open" && invite.relation === "friends") {
    redirect(`/amigos/${invite.person.id}`);
  }
  if (current) redirect(`/amigos/pedidos?convite=${encodeURIComponent(token)}`);
  const page = { invite, back: encodeURIComponent(friendLinkPath(token)) };
  // An old or broken link is a real 404, not an empty page that answers 200.
  return data(page, { status: invite.status === "open" ? 200 : 404 });
});

function SignInCard({
  person,
  back,
}: {
  person: { name: string; image: string | null };
  back: string;
}) {
  return (
    <section className="flex w-full max-w-90 flex-col gap-2.5 rounded-2xl border border-line bg-surface-2 p-3">
      <div className="flex items-center gap-3">
        <UserAvatar image={person.image} className="size-11 shrink-0" />
        <p className="min-w-0 flex-1 text-sm">
          <span className="font-semibold">{person.name}</span> te convidou
          <span className="block text-xs text-ink-muted">Entre para adicionar</span>
        </p>
      </div>
      <div className="flex gap-2 pl-14">
        <Button asChild size="sm">
          <Link to={`/cadastro?voltar=${back}`}>Criar conta</Link>
        </Button>
        <Button asChild size="sm" variant="outline">
          <Link to={`/entrar?voltar=${back}`}>Entrar</Link>
        </Button>
      </div>
    </section>
  );
}

export default function FriendLinkPage() {
  const { invite, back } = useLoaderData<typeof loader>();
  return (
    <div className="flex min-h-dvh flex-col bg-canvas">
      <header className="px-4 pt-4 sm:px-6">
        <NavBar aria-label="Principal" className="mx-auto max-w-[90rem]">
          <NavBrand href="/" />
          <ThemeToggle className="ml-auto" />
        </NavBar>
      </header>
      <main className="flex flex-col items-center px-4 pt-10">
        {invite.status === "open" ? (
          <SignInCard person={invite.person} back={back} />
        ) : (
          <section className="flex max-w-90 flex-col items-center gap-3 text-center">
            <h1 className="text-xl font-semibold tracking-tight">Este link não funciona mais</h1>
            <p className="text-sm text-ink-muted">Peça um link novo para quem te convidou.</p>
            <Button asChild size="sm" variant="outline">
              <Link to="/">Ir para o início</Link>
            </Button>
          </section>
        )}
      </main>
    </div>
  );
}

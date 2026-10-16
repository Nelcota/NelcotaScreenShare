import { ArrowLeft } from "lucide-react";
import { Link, useLoaderData, useRouteLoaderData } from "react-router";
import { requireUser } from "@/features/auth/server/participant-session.server";
import { friendProfile } from "@/features/friends/server/friend-profile.server";
import { FriendProfilePanel } from "@/features/friends/ui/FriendProfilePanel";
import { PanelClose } from "@/features/friends/ui/PanelClose";
import { conversationPage } from "@/features/messages/server/conversation-page.server";
import { ConversationView } from "@/features/messages/ui/ConversationView";
import { getDb } from "@/server/db/index.server";
import { getEnv } from "@/server/env.server";
import { notFound } from "@/server/http.server";
import { routeLoader } from "@/server/route-loader.server";
import type { loader as appLoader } from "./layout";
import { Button } from "@/components/ui/button";
import { formatMonthYear } from "@/lib/format";

export const meta = () => [
  { title: "Mensagens · Nelcota" },
  { name: "robots", content: "noindex" },
];

export const loader = routeLoader(async ({ params }) => {
  const conversationId = params.conversa ?? "";
  const current = await requireUser(`/mensagens/${conversationId}`);
  const valid = /^[0-9a-f-]{36}$/i.test(conversationId);
  const page = valid ? await conversationPage(getDb(), current.user.id, conversationId) : null;
  if (!page) notFound();
  const otherId = page.conversation.kind === "direct" ? page.conversation.others[0]?.id : undefined;
  const profile = otherId ? await friendProfile(getDb(), current.user.id, otherId) : null;
  // Public by design: the browser calls KLIPY with it (docs/development.md).
  return {
    ...page,
    klipyKey: getEnv().KLIPY_API_KEY ?? null,
    profile: profile ? { ...profile, since: formatMonthYear(profile.since) } : null,
  };
});

/** An open conversation in the middle; on a phone it takes the whole screen. */
export default function ConversationPage() {
  const data = useLoaderData<typeof loader>();
  const app = useRouteLoaderData<typeof appLoader>("app");
  return (
    <ConversationView
      key={data.conversation.id}
      data={data}
      selfId={app?.selfId ?? ""}
      leading={
        <Button asChild variant="quiet" size="icon-lg" className="sm:hidden">
          <Link viewTransition to="/amigos" aria-label="Voltar aos amigos">
            <ArrowLeft className="size-5" aria-hidden="true" />
          </Link>
        </Button>
      }
      trailing={<PanelClose />}
      profile={
        data.profile
          ? {
              panel: (
                <FriendProfilePanel
                  profile={data.profile}
                  status={data.conversation.status ?? "offline"}
                />
              ),
              link: `/amigos/${data.profile.id}`,
            }
          : undefined
      }
    />
  );
}

import { routeLoader } from "@/server/route-loader.server";
import { useLoaderData, type MetaFunction } from "react-router";

import { HomeScene } from "@/features/home/ui/HomeScene";
import { CreateRoomOnArrival } from "@/features/home/ui/CreateRoomOnArrival";
import { getUserSession } from "@/features/auth/server/participant-session.server";
import { getEnv } from "@/server/env.server";
import { INDEXABLE, originFromMatches, pageMeta } from "@/lib/seo";
import { noticeFor } from "@/lib/notice";

export const handle = INDEXABLE;

export const meta: MetaFunction = ({ matches }) =>
  pageMeta({
    title: "Nelcota · Mostre sua tela com som e ponteiro, direto do navegador",
    description:
      "Compartilhamento de tela para times de tecnologia: mostre um bug com o som junto, aponte na tela de quem apresenta e chame o time por link. Sem instalar nada.",
    path: "/",
    origin: originFromMatches(matches),
  });

const NOTICES: Record<string, string> = {
  "conta-excluida": "Sua conta foi excluída. Obrigado por usar o Nelcota.",
};

export const loader = routeLoader(async ({ searchParams }) => {
  const { erro, aviso, criar } = searchParams;
  const current = await getUserSession();
  return {
    erro,
    aviso,
    account: current ? { name: current.user.name, image: current.user.image } : null,
    // Back from sign-up or sign-in after "Criar sala": the room is created on arrival.
    createRoomOnArrival: criar === "sala" && current !== null,
    maxParticipants: getEnv().MAX_PARTICIPANTS,
  };
});

export default function HomePage() {
  const { erro, aviso, account, maxParticipants, createRoomOnArrival } =
    useLoaderData<typeof loader>();
  return (
    <>
      <HomeScene
        invalidCode={erro === "codigo"}
        account={account}
        maxParticipants={maxParticipants}
        notice={noticeFor(NOTICES, aviso)}
      />
      {createRoomOnArrival ? <CreateRoomOnArrival /> : null}
    </>
  );
}

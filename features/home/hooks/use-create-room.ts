import { useEffect, useRef, useState, useTransition } from "react";
import { useNavigate, useRouteLoaderData } from "react-router";
import { toast } from "sonner";
import type { loader as rootLoader } from "@/app/root";
import { SESSION_EXPIRED_MESSAGE } from "@/features/auth/domain/auth-errors";
import { createRoomEntryHref } from "@/features/home/domain/new-room";
import { createRoomAction } from "@/features/room/actions";
import { useOperation } from "@/lib/operations/use-operation";

/**
 * "Criar sala": the server creates the room and the page opens it. The server also decides
 * whether there is a session: a signed-in flag from the page can be stale. Without one, the
 * page only says where to go: sign-up for a visitor, sign-in for an expired session.
 * `replace`: the room takes the place of the current entry (the return from sign-up).
 */
export function useCreateRoom({ replace = false }: { replace?: boolean } = {}) {
  const navigate = useNavigate();
  const hadAccount = useRouteLoaderData<typeof rootLoader>("root")?.account != null;
  const [navigating, startTransition] = useTransition();
  const [createdPath, setCreatedPath] = useState<string>();
  const openedPath = useRef<string>(undefined);
  const create = useOperation(createRoomAction, {
    onSuccess: ({ data }) => setCreatedPath(data.path),
    onError: ({ error }) => {
      if (error.serverError === SESSION_EXPIRED_MESSAGE) {
        startTransition(() => navigate(createRoomEntryHref(hadAccount), { viewTransition: true }));
        return;
      }
      toast.error(error.serverError ?? "Não foi possível criar a sala. Tente de novo.");
    },
  });

  // Opens the room only after the operation finished revalidating the page: navigating
  // while that revalidation runs leaves the browser on the home page.
  useEffect(() => {
    if (createdPath === undefined || create.isPending) return;
    if (openedPath.current === createdPath) return;
    openedPath.current = createdPath;
    startTransition(() => navigate(createdPath, { replace, viewTransition: true }));
  }, [createdPath, create.isPending, navigate, replace]);

  return { createRoom: () => create.execute(), pending: navigating || create.isPending };
}

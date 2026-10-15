import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router";
import { notify } from "@/features/notifications/client/notify";
import { firstName } from "@/features/messages/domain/conversation-display";
import { isNewerMessage } from "@/features/messages/domain/newer-message";

export interface LatestUnread {
  id: string;
  conversationId: string;
  authorName: string;
  body: string | null;
}

/**
 * A new unread message from someone else: counts on the tab and, in the background, shows
 * a system notification (the first one offers to turn them on). Nothing for the conversation
 * open in front of the person, nor for what was already unread when the page opened, nor for
 * an older unread that becomes the latest again once a newer one is read.
 */
export function useMessageNotifications(latest: LatestUnread | null) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const seen = useRef(latest?.id);
  useEffect(() => {
    if (!latest || !isNewerMessage(latest.id, seen.current)) return;
    seen.current = latest.id;
    const path = `/mensagens/${latest.conversationId}`;
    if (document.visibilityState === "visible" && pathname === path) return;
    notify({
      kind: "message",
      title: `Nova mensagem de ${firstName(latest.authorName)}`,
      body: latest.body ?? "GIF",
      tag: `mensagem-${latest.conversationId}`,
      onAction: () => void navigate(path, { viewTransition: true }),
    });
  }, [latest, pathname, navigate]);
}

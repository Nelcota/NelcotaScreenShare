import { Ellipsis, LogOut, UserRound } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { leaveGroup, listMessages, markConversationRead } from "@/features/messages/actions";
import {
  composerPlaceholder,
  conversationTitle,
  type ConversationItem,
} from "@/features/messages/domain/conversation-display";
import {
  mergeMessages,
  type TimelineCall,
  type TimelineMessage,
} from "@/features/messages/domain/timeline";
import { GroupCallBanner, type LiveGroupCall } from "@/features/messages/ui/GroupCallBanner";
import { KlipyContext, klipyFor } from "@/features/messages/hooks/use-gif";
import { Composer } from "@/features/messages/ui/Composer";
import { ConversationAvatar } from "@/features/messages/ui/ConversationAvatar";
import { MessageTimeline } from "@/features/messages/ui/MessageTimeline";
import {
  ProfileToggle,
  useProfileOpen,
  type ConversationProfile,
} from "@/features/messages/ui/ConversationProfile";
import { GroupCallButton, IconCallButton } from "@/features/ringing/ui/CallButton";
import { offerNotifications } from "@/features/notifications/client/permission-offer";
import { useOperation } from "@/lib/operations/use-operation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const STATUS_LABEL = {
  online: "Online",
  away: "Ausente",
  busy: "Não perturbe",
  offline: "Offline",
};

export interface OpenConversation {
  conversation: Pick<ConversationItem, "id" | "kind" | "name" | "others" | "status">;
  messages: TimelineMessage[];
  hasMore: boolean;
  canSend: boolean;
  klipyKey: string | null;
  gifFavorites: string[];
  groupCall: LiveGroupCall | null;
  calls: TimelineCall[];
}

function MoreMenu({ conversation }: { conversation: OpenConversation["conversation"] }) {
  const navigate = useNavigate();
  const leave = useOperation(leaveGroup, {
    onSuccess: () => void navigate("/amigos", { replace: true, viewTransition: true }),
    onError: () => toast.error("Não foi possível sair agora."),
  });
  const [other] = conversation.others;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="quiet" size="icon-lg" aria-label="Mais opções">
          <Ellipsis aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {conversation.kind === "direct" && other ? (
          <DropdownMenuItem asChild>
            <Link viewTransition to={`/amigos/${other.id}`}>
              <UserRound aria-hidden="true" />
              Ver perfil
            </Link>
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem
            variant="destructive"
            disabled={leave.isPending}
            onSelect={() => leave.execute({ conversationId: conversation.id })}
          >
            <LogOut aria-hidden="true" />
            Sair do grupo
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function Header({
  conversation,
  liveCall,
  leading,
  trailing,
  profile,
  profileOpen,
  onToggleProfile,
}: {
  conversation: OpenConversation["conversation"];
  liveCall: boolean;
  leading?: ReactNode;
  trailing?: ReactNode;
  profile?: ConversationProfile;
  profileOpen: boolean;
  onToggleProfile: () => void;
}) {
  const [other] = conversation.others;
  const direct = conversation.kind === "direct";
  const detail = direct
    ? STATUS_LABEL[conversation.status ?? "offline"]
    : `${conversation.others.length + 1} pessoas`;
  return (
    <header className="flex items-center gap-3 border-b border-line px-4 py-3">
      {leading}
      <ConversationAvatar conversation={conversation} />
      <span className="min-w-0 flex-1">
        <h1 className="truncate text-base font-semibold">{conversationTitle(conversation)}</h1>
        <span className="block text-xs text-ink-muted">{detail}</span>
      </span>
      {direct && other ? (
        <IconCallButton
          friend={{ id: other.id, name: other.name, status: conversation.status ?? "offline" }}
        />
      ) : null}
      {direct && profile ? (
        <ProfileToggle profile={profile} open={profileOpen} onToggle={onToggleProfile} />
      ) : null}
      {!direct && !liveCall ? (
        <GroupCallButton
          conversationId={conversation.id}
          name={conversationTitle(conversation)}
          className="h-9 max-sm:size-9 max-sm:justify-center max-sm:px-0"
        />
      ) : null}
      {direct ? null : <MoreMenu conversation={conversation} />}
      {trailing}
    </header>
  );
}

/**
 * The messages on screen: every page seen (older ones fetched on demand, and each newest
 * page the loader brought) joined by id with the loader's current page, so nothing in
 * between goes missing when new messages arrive.
 */
function useTimeline(conversationId: string, page: TimelineMessage[], initialHasMore: boolean) {
  const [seen, setSeen] = useState(page);
  const [lastPage, setLastPage] = useState(page);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [loading, setLoading] = useState(false);
  // A new page from the loader joins what was seen while rendering, without an effect.
  if (page !== lastPage) {
    setLastPage(page);
    setSeen((current) => mergeMessages(current, page));
  }
  const messages = mergeMessages(seen, page);
  const load = async () => {
    const beforeId = messages[0]?.id;
    if (!beforeId || loading) return;
    setLoading(true);
    const result = await listMessages({ conversationId, beforeId });
    setLoading(false);
    if (!result.data) return toast.error("Não foi possível carregar agora.");
    const olderPage = result.data.messages.map((message) => ({
      ...message,
      createdAt: new Date(message.createdAt),
    }));
    setSeen((current) => mergeMessages(olderPage, current));
    setHasMore(result.data.hasMore);
  };
  return { messages, hasMore, loading, load };
}

/** Reading the conversation clears its unread count, here and on the other tabs. */
function useMarkRead(conversationId: string, latestId: string | undefined) {
  const mark = useOperation(markConversationRead);
  const execute = mark.execute;
  useEffect(() => {
    if (!latestId) return;
    const read = () => {
      if (document.visibilityState === "visible") execute({ conversationId });
    };
    read();
    document.addEventListener("visibilitychange", read);
    return () => document.removeEventListener("visibilitychange", read);
  }, [conversationId, latestId, execute]);
}

/** Keeps the newest message in view when it arrives. */
function useStickToBottom(latestId: string | undefined) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const box = ref.current;
    if (!box || !latestId) return;
    box.scrollTop = box.scrollHeight;
  }, [latestId]);
  return ref;
}

export function ConversationView({
  data,
  selfId,
  leading,
  trailing,
  profile,
}: {
  data: OpenConversation;
  selfId: string;
  /** The back link on phones. */
  leading?: ReactNode;
  /** The panel's X. */
  trailing?: ReactNode;
  /** The friend's profile, for direct conversations. */
  profile?: ConversationProfile;
}) {
  const { conversation } = data;
  const latestId = data.messages.at(-1)?.id;
  const timeline = useTimeline(conversation.id, data.messages, data.hasMore);
  useMarkRead(conversation.id, latestId);
  // Opening a conversation is a good moment to offer notifications, with the tab in front.
  useEffect(() => offerNotifications(), []);
  const scroller = useStickToBottom(latestId);
  const profilePanel = useProfileOpen();
  const showProfile = profile !== undefined && profilePanel.open;
  return (
    <KlipyContext value={klipyFor(data.klipyKey)}>
      <div data-phone-fill className="flex h-full">
        <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col">
          <Header
            conversation={conversation}
            liveCall={data.groupCall !== null}
            leading={leading}
            trailing={trailing}
            profile={profile}
            profileOpen={showProfile}
            onToggleProfile={profilePanel.toggle}
          />
          {data.groupCall ? <GroupCallBanner call={data.groupCall} /> : null}
          <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto">
            {timeline.hasMore ? (
              <p className="pt-3 text-center">
                <button
                  type="button"
                  disabled={timeline.loading}
                  onClick={() => void timeline.load()}
                  className="text-sm font-semibold text-brand-soft hover:underline disabled:opacity-60"
                >
                  Mensagens anteriores
                </button>
              </p>
            ) : null}
            <MessageTimeline
              messages={timeline.messages}
              calls={data.calls}
              selfId={selfId}
              showNames={conversation.kind === "group"}
            />
          </div>
          {data.canSend ? (
            <Composer
              conversationId={conversation.id}
              placeholder={composerPlaceholder(conversation)}
              favorites={data.gifFavorites}
            />
          ) : (
            <p className="border-t border-line px-4 py-4 text-center text-sm text-ink-muted">
              Só dá para mandar mensagem para amigos.
            </p>
          )}
        </div>
        {profile ? (
          // Stays mounted so it can slide open and closed; closed, it is out of reach.
          <aside
            aria-label="Perfil"
            aria-hidden={!showProfile}
            inert={!showProfile}
            className={cn(
              "hidden shrink-0 overflow-hidden border-line transition-[width,opacity] duration-(--motion-surface) ease-(--ease-out-smooth) motion-reduce:transition-none lg:block",
              showProfile ? "w-72 border-l opacity-100" : "w-0 opacity-0",
            )}
          >
            <div className="h-full w-72 overflow-y-auto">{profile.panel}</div>
          </aside>
        ) : null}
      </div>
    </KlipyContext>
  );
}

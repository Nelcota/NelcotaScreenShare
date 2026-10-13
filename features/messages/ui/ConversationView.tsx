import { LogOut, MoreHorizontal, UserRound } from "lucide-react";
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
import type { TimelineCall, TimelineMessage } from "@/features/messages/domain/timeline";
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

const STATUS_LABEL = { online: "Online", away: "Ausente", busy: "Ocupado", offline: "Offline" };

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
      <DropdownMenuTrigger
        aria-label="Mais opções"
        className="grid size-9 shrink-0 place-items-center rounded-full text-ink-muted transition-colors hover:bg-surface-3 hover:text-ink"
      >
        <MoreHorizontal className="size-4" aria-hidden="true" />
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

/** Older pages are fetched on demand and kept above the newest page from the loader. */
function useOlder(conversationId: string, firstId: string | undefined, initialHasMore: boolean) {
  const [older, setOlder] = useState<TimelineMessage[]>([]);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [loading, setLoading] = useState(false);
  const load = async () => {
    const beforeId = older[0]?.id ?? firstId;
    if (!beforeId || loading) return;
    setLoading(true);
    const result = await listMessages({ conversationId, beforeId });
    setLoading(false);
    if (!result.data) return toast.error("Não foi possível carregar agora.");
    const page = result.data.messages.map((message) => ({
      ...message,
      createdAt: new Date(message.createdAt),
    }));
    setOlder((current) => [...page, ...current]);
    setHasMore(result.data.hasMore);
  };
  return { older, hasMore, loading, load };
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
  const older = useOlder(conversation.id, data.messages[0]?.id, data.hasMore);
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
            {older.hasMore ? (
              <p className="pt-3 text-center">
                <button
                  type="button"
                  disabled={older.loading}
                  onClick={() => void older.load()}
                  className="text-sm font-semibold text-brand-soft hover:underline disabled:opacity-60"
                >
                  Mensagens anteriores
                </button>
              </p>
            ) : null}
            <MessageTimeline
              messages={[...older.older, ...data.messages]}
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

import { Archive } from "lucide-react";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import { StatusScreen } from "./StatusScreen";
import { lazy, Suspense, useEffect, useEffectEvent, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { CallShell, ScreenShell } from "./RoomShell";
import { requestToken } from "@/features/room/client/api";
import type { JoinChoices } from "@/features/room/domain/join";
import type { RoomPresence } from "@/features/room/domain/presence";
import { callDuration, type LeaveNotice, type LeaveReason } from "@/features/room/domain/leave";
import { roomLink } from "@/features/room/domain/room-code";
import { PreJoin } from "@/features/room/ui/prejoin/PreJoin";
import { LeftScreen } from "./LeftScreen";
import { logBrowserWarning } from "@/lib/telemetry.client";

const loadRoomView = () => import("./call/RoomView");
const RoomView = lazy(async () => ({ default: (await loadRoomView()).RoomView }));
const prepareRoomView = () => {
  void prefetchRoomView();
};

/** Best effort: if the prefetch fails, `lazy` loads (and reports) it again on render. */
async function prefetchRoomView() {
  try {
    await loadRoomView();
  } catch (error) {
    logBrowserWarning("Could not prefetch the room view", error);
  }
}

interface RoomSessionProps {
  code: string;
  unavailable?: string;
  permanent?: boolean;
  /** Null for a guest (no account). */
  userName: string | null;
  userImage: string | null;
  passwordRequired: boolean;
  invite?: string;
  maxParticipants: number;
  roomName: string | null;
  /** People in the room now (null: unknown). */
  presence: RoomPresence | null;
  /** Shows the link to the admin panel inside the call. */
  isAdmin: boolean;
  /** Another page is open: a call goes on hidden; anything else shows nothing. */
  minimized: boolean;
  /** Whether there is a call to keep while the person visits other pages. */
  onCallChange: (inCall: boolean) => void;
  /** The app's friends column, signed in; `inCall` starts it as the rail. */
  renderColumn?: (inCall: boolean) => ReactNode;
}

type Phase =
  | { kind: "prejoin" }
  /** `startedAt`: when they joined, for the leave summary (kept across attempts). */
  | { kind: "room"; choices: JoinChoices; attempt: number; startedAt: number }
  | { kind: "left"; reason: LeaveReason; message?: string; durationMs?: number };

export function RoomSession({
  code,
  unavailable,
  permanent,
  userName,
  userImage,
  passwordRequired,
  invite,
  maxParticipants,
  roomName,
  presence,
  isAdmin,
  minimized,
  onCallChange,
  renderColumn,
}: RoomSessionProps) {
  const [phase, setPhase] = useState<Phase>({ kind: "prejoin" });
  const inCall = phase.kind === "room";
  const reportCall = useEffectEvent(onCallChange);

  useEffect(() => {
    reportCall(inCall);
  }, [inCall]);

  // New attempt with a new token: the previous one may have expired (10 min TTL).
  async function retry(choices: JoinChoices, attempt: number, startedAt: number) {
    const result = await requestToken({
      room: code,
      password: choices.password,
      invite,
      guestName: choices.guestName,
    });
    if (!result.ok) {
      setPhase({ kind: "left", reason: "failed", message: result.message });
      return;
    }
    setPhase({
      kind: "room",
      choices: {
        ...choices,
        token: result.data.token,
        serverUrl: result.data.serverUrl,
        sessionId: result.data.sessionId,
      },
      attempt: attempt + 1,
      startedAt,
    });
  }

  function leave(notice: LeaveNotice | undefined, startedAt: number | undefined) {
    // The leave screen is not on display: the notice goes to a toast instead.
    if (minimized) toast.info(notice?.message ?? "Você saiu da sala.");
    setPhase({
      kind: "left",
      reason: notice?.reason ?? "self",
      message: notice?.message,
      durationMs: notice?.reason === "failed" ? undefined : callDuration(startedAt, Date.now()),
    });
  }

  if (phase.kind === "room") {
    return (
      <CallShell column={renderColumn?.(true)} minimized={minimized}>
        <Suspense
          fallback={
            <output hidden={minimized} className="grid min-h-dvh place-items-center text-ink-muted">
              Preparando a sala…
            </output>
          }
        >
          <RoomView
            key={phase.attempt}
            code={code}
            choices={phase.choices}
            maxParticipants={maxParticipants}
            roomName={roomName}
            isAdmin={isAdmin}
            minimized={minimized}
            onLeave={(notice) => leave(notice, phase.startedAt)}
            onRetry={() => retry(phase.choices, phase.attempt, phase.startedAt)}
          />
        </Suspense>
      </CallShell>
    );
  }

  if (minimized) return null;
  const account = userName === null ? null : { name: userName, image: userImage };

  if (unavailable)
    return (
      <ScreenShell column={renderColumn?.(false)} account={account}>
        <StatusScreen icon={Archive} title="Sala indisponível" message={unavailable}>
          <Button asChild>
            <Link to={userName ? "/salas" : "/"}>Voltar</Link>
          </Button>
        </StatusScreen>
      </ScreenShell>
    );

  return (
    <ScreenShell
      column={renderColumn?.(false)}
      account={account}
      accountHref={`/conta?voltar=${encodeURIComponent(roomLink(code, invite))}`}
    >
      {phase.kind === "prejoin" ? (
        <PreJoin
          onPrepareJoin={prepareRoomView}
          code={code}
          userName={userName}
          passwordRequired={passwordRequired && !invite}
          invite={invite}
          presence={presence}
          maxParticipants={maxParticipants}
          onJoin={(choices) =>
            setPhase({ kind: "room", choices, attempt: 0, startedAt: Date.now() })
          }
        />
      ) : (
        <LeftScreen
          code={code}
          reason={phase.reason}
          permanent={permanent}
          message={phase.message}
          durationMs={phase.durationMs}
          guest={userName === null}
          onRejoin={() => setPhase({ kind: "prejoin" })}
        />
      )}
    </ScreenShell>
  );
}

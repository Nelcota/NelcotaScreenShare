import type { RoomTitle } from "@/features/room/domain/room-title";
import { Archive } from "lucide-react";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import { StatusScreen } from "./StatusScreen";
import { lazy, Suspense, useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { CallShell, ScreenShell } from "./RoomShell";
import { requestToken } from "@/features/room/client/api";
import type { JoinChoices } from "@/features/room/domain/join";
import type { RoomPresence } from "@/features/room/domain/presence";
import { callDuration, type LeaveNotice, type LeaveReason } from "@/features/room/domain/leave";
import { roomLink } from "@/features/room/domain/room-code";
import { useAnsweredCall } from "@/features/room/hooks/use-answered-call";
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

/**
 * On the pre-join, fetch the call code once the page is idle: phones have no hover, so
 * waiting for the "Entrar" tap meant downloading it only after the person asked to join.
 */
function usePrefetchRoomViewWhenIdle(active: boolean) {
  useEffect(() => {
    if (!active) return;
    if (typeof window.requestIdleCallback !== "function") {
      const timer = window.setTimeout(prepareRoomView, 2000);
      return () => window.clearTimeout(timer);
    }
    const handle = window.requestIdleCallback(prepareRoomView, { timeout: 4000 });
    return () => window.cancelIdleCallback(handle);
  }, [active]);
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
  roomName: RoomTitle | null;
  /** People in the room now (null: unknown). */
  presence: RoomPresence | null;
  /** Shows the link to the admin panel inside the call. */
  panelShortcut: boolean;
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
  | {
      kind: "room";
      choices: JoinChoices;
      attempt: number;
      startedAt: number;
      /** Joined without the pre-join (from "Chamar" or a ring). */
      direct?: boolean;
    }
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
  panelShortcut,
  minimized,
  onCallChange,
  renderColumn,
}: RoomSessionProps) {
  const [phase, setPhase] = useState<Phase>({ kind: "prejoin" });
  usePrefetchRoomViewWhenIdle(phase.kind === "prejoin");

  // The parent hears about the call where the phase changes, not from an effect after it.
  function changePhase(next: Phase) {
    setPhase(next);
    onCallChange(next.kind === "room");
  }
  // Only the first pre-join after accepting a ring joins on its own.
  const answered = useAnsweredCall();
  const [autoJoin, setAutoJoin] = useState(answered);

  // New attempt with a new token: the previous one may have expired (10 min TTL).
  async function retry(choices: JoinChoices, attempt: number, startedAt: number) {
    const result = await requestToken({
      room: code,
      password: choices.password,
      invite,
      guestName: choices.guestName,
    });
    if (!result.ok) {
      changePhase({ kind: "left", reason: "failed", message: result.message });
      return;
    }
    changePhase({
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
    if (minimized) toast.info(notice?.message ?? "Você saiu da chamada.");
    changePhase({
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
            panelShortcut={panelShortcut}
            minimized={minimized}
            onLeave={(notice) => leave(notice, phase.startedAt)}
            onRetry={() => retry(phase.choices, phase.attempt, phase.startedAt)}
            directEntry={phase.direct === true && phase.attempt === 0}
          />
        </Suspense>
      </CallShell>
    );
  }

  if (minimized) return null;
  // Someone on the team gets the panel's shortcut here too, as in the call.
  const account =
    userName === null ? null : { name: userName, image: userImage, panel: panelShortcut };

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
          roomName={roomName?.followsOwner === false ? roomName.text : null}
          userName={userName}
          userImage={userImage}
          passwordRequired={passwordRequired && !invite}
          invite={invite}
          presence={presence}
          maxParticipants={maxParticipants}
          autoJoin={autoJoin}
          onJoin={(choices) => {
            setAutoJoin(false);
            changePhase({
              kind: "room",
              choices,
              attempt: 0,
              startedAt: Date.now(),
              direct: autoJoin,
            });
          }}
        />
      ) : (
        <LeftScreen
          code={code}
          reason={phase.reason}
          permanent={permanent}
          message={phase.message}
          durationMs={phase.durationMs}
          guest={userName === null}
          onRejoin={() => changePhase({ kind: "prejoin" })}
        />
      )}
    </ScreenShell>
  );
}

import { useStreamerMode } from "@/features/room/hooks/use-streamer-mode";
import { ArrowLeft, Check, Link2, Lock, Plus, RotateCcw } from "lucide-react";
import { useEffect, useRef } from "react";
import { Link, useLocation, useViewTransitionState } from "react-router";
import { Button } from "@/components/ui/button";
import type { Expression } from "@/features/mascot/domain/face";
import { Mascot } from "@/features/mascot/ui/Mascot";
import { formatCallDuration, type LeaveReason } from "@/features/room/domain/leave";
import { useCopyRoomLink } from "@/features/room/hooks/use-copy-room-link";
import { gsap, MOTION_DURATION, MOTION_QUERIES, useGSAP } from "@/lib/animation/gsap";

/** Title, mascot mood and what can be done for each leave reason. */
const COPY: Record<
  LeaveReason,
  { title: string; expression: Expression; rejoin: string | null; copyLink: boolean }
> = {
  self: {
    title: "Você saiu da sala",
    expression: "happy",
    rejoin: "Voltar para a sala",
    copyLink: true,
  },
  dropped: {
    title: "A conexão caiu",
    expression: "worried",
    rejoin: "Voltar para a sala",
    copyLink: true,
  },
  failed: {
    title: "Não foi possível entrar",
    expression: "worried",
    rejoin: "Tentar de novo",
    copyLink: false,
  },
  // Rejoining here drops the other tab: it stays an option, not the main action.
  elsewhere: {
    title: "Você está na sala em outro lugar",
    expression: "surprised",
    rejoin: "Usar esta aba",
    copyLink: false,
  },
  ended: { title: "A sala foi encerrada", expression: "neutral", rejoin: null, copyLink: false },
  removed: {
    title: "Você foi removido da sala",
    expression: "neutral",
    rejoin: null,
    copyLink: false,
  },
};

function CopyRoomLink({ code }: { code: string }) {
  const { copied, copy } = useCopyRoomLink(code);
  return (
    <Button variant="outline" size="lg" aria-live="polite" onClick={() => void copy()}>
      {copied ? (
        <Check className="text-success" aria-hidden="true" />
      ) : (
        <Link2 aria-hidden="true" />
      )}
      {copied ? "Link copiado" : "Copiar link"}
    </Button>
  );
}

/** A guest who took part sees how to open their own rooms. */
function GuestSignUp({ guest, joined }: { guest: boolean; joined: boolean }) {
  if (!guest || !joined) return null;
  return (
    <div data-anim="left" className="panel flex w-full flex-col items-center gap-3 rounded-2xl p-5">
      <p className="text-base text-pretty">
        Quer abrir suas próprias salas? Crie uma conta grátis em poucos segundos.
      </p>
      <Button asChild variant="secondary">
        <Link viewTransition to="/cadastro">
          Criar conta grátis
        </Link>
      </Button>
    </div>
  );
}

function CallSummary({ code, durationMs }: { code: string; durationMs?: number }) {
  const { enabled: streamerMode } = useStreamerMode();
  if (durationMs === undefined) return null;
  return (
    <p className="text-lg text-pretty text-ink-muted">
      Você ficou <strong className="font-medium text-ink">{formatCallDuration(durationMs)}</strong>{" "}
      na sala
      {!streamerMode ? (
        <span translate="no" className="font-medium text-ink tabular-nums">
          {" "}
          {code}
        </span>
      ) : null}
      .
    </p>
  );
}

/**
 * After the call: why it ended, how long it lasted and the next step.
 * No card: the mascot says goodbye, just as it welcomed on the way in.
 */
export function LeftScreen({
  code,
  reason,
  message,
  durationMs,
  guest,
  onRejoin,
}: {
  code: string;
  reason: LeaveReason;
  message?: string;
  /** Time in the call; absent when the person never got in. */
  durationMs?: number;
  /** Joined without an account: the way to open their own rooms is to create one. */
  guest: boolean;
  onRejoin: () => void;
}) {
  const scope = useRef<HTMLElement>(null);
  const copy = COPY[reason];
  const { enabled: streamerMode } = useStreamerMode();
  const transitioning = useViewTransitionState(useLocation().pathname);
  const joined = durationMs !== undefined;
  // Room ended or person removed: the way forward is the home page, not the same room.
  const rejoinIsPrimary = copy.rejoin !== null && reason !== "elsewhere";

  useGSAP(
    () => {
      if (transitioning) return;
      const media = gsap.matchMedia();
      media.add(MOTION_QUERIES.motion, () => {
        gsap.from("[data-anim=left]", {
          y: 10,
          opacity: 0,
          duration: MOTION_DURATION.entrance,
          stagger: 0.045,
          clearProps: "transform,opacity",
        });
      });
    },
    { scope },
  );

  // Focus on the next step: Enter goes back to the room (or to the home page).
  useEffect(() => {
    scope.current?.querySelector<HTMLElement>("[data-primary]")?.focus();
  }, []);

  return (
    <section
      ref={scope}
      aria-labelledby="left-title"
      role={reason === "self" ? undefined : "alert"}
      className="flex w-full max-w-md flex-col items-center gap-6 text-center"
    >
      <div data-anim="left">
        <Mascot
          className="size-28"
          sizes="336px"
          canSleep={false}
          expression={copy.expression}
          activity={reason === "self" ? "greeting" : "idle"}
        />
      </div>

      <div data-anim="left" className="flex flex-col gap-2">
        <h1 id="left-title" className="text-3xl font-semibold tracking-[-0.025em] text-balance">
          {copy.title}
        </h1>
        <CallSummary code={code} durationMs={durationMs} />
        {reason !== "self" && message ? (
          <p className="text-base text-pretty text-ink-muted">{message}</p>
        ) : null}
      </div>

      <div data-anim="left" className="flex w-full flex-col items-center gap-3">
        <div className="flex w-full flex-col gap-3 sm:flex-row sm:justify-center [&>*]:sm:flex-1">
          {rejoinIsPrimary ? (
            <Button size="lg" data-primary="" onClick={onRejoin}>
              <RotateCcw aria-hidden="true" />
              {copy.rejoin}
            </Button>
          ) : (
            <Button asChild size="lg" data-primary="">
              <Link viewTransition to="/">
                <Plus aria-hidden="true" />
                {reason === "ended" ? "Criar nova sala" : "Ir para o início"}
              </Link>
            </Button>
          )}
          {copy.copyLink && !streamerMode ? <CopyRoomLink code={code} /> : null}
          {copy.rejoin && !rejoinIsPrimary ? (
            <Button variant="outline" size="lg" onClick={onRejoin}>
              <RotateCcw aria-hidden="true" />
              {copy.rejoin}
            </Button>
          ) : null}
        </div>
        {rejoinIsPrimary ? (
          <Link
            viewTransition
            to="/"
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-ink-muted transition-colors hover:text-ink focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Ir para o início
          </Link>
        ) : null}
      </div>

      <GuestSignUp guest={guest} joined={joined} />

      {joined ? (
        <p
          data-anim="left"
          className="flex items-center gap-1.5 text-sm text-pretty text-ink-subtle"
        >
          <Lock className="size-3.5 shrink-0" aria-hidden="true" />
          O chat foi apagado e nada da chamada foi gravado.
        </p>
      ) : null}
    </section>
  );
}

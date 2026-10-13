import { AudioLines, Check, Loader2, Mic, MicOff, RotateCcw, ShieldAlert } from "lucide-react";
import { useId, type RefObject } from "react";
import { Button } from "@/components/ui/button";
import { MicrophoneSelect } from "./MicrophoneSelect";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { MicSetupState } from "@/features/room/hooks/use-mic-setup";
import { cn } from "@/lib/utils";
import type { MicrophoneCheck } from "@/features/room/domain/microphone-check";

const CHECK_TEXT: Record<MicrophoneCheck, string> = {
  starting: "Conectando microfone…",
  waiting: "Fale para testar",
  detected: "Captando áudio",
  confirmed: "Microfone testado",
};

/** "Microfone" row of the pre-join screen: on/off and, when on, what to do in each situation. */
export function MicSetup({
  mic,
  meterRef,
}: {
  mic: MicSetupState;
  /** Meter bar (written directly, no re-render). */
  meterRef: RefObject<HTMLDivElement | null>;
}) {
  const micId = useId();
  return (
    <fieldset className="flex min-w-0 flex-col gap-4 px-4 py-4">
      <legend className="sr-only">Microfone</legend>
      <div className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className={cn(
            "grid size-10 shrink-0 place-items-center rounded-full transition-colors",
            mic.joinsMuted ? "bg-danger/15 text-danger" : "bg-brand/15 text-brand-soft",
          )}
        >
          {mic.joinsMuted ? <MicOff className="size-4.5" /> : <Mic className="size-4.5" />}
        </span>
        <Label htmlFor={micId} className="min-w-0 flex-1 flex-col items-start gap-1">
          <span className="text-base font-medium text-ink">Microfone</span>
          <span className="text-sm leading-5 font-normal text-ink-muted">
            {!mic.enabled
              ? "Desligado: você entra só ouvindo"
              : mic.blocked
                ? "Bloqueado pelo navegador"
                : "Entrar com microfone ligado"}
          </span>
        </Label>
        <Switch
          id={micId}
          checked={mic.enabled}
          onCheckedChange={(checked) => mic.setEnabled(checked)}
        />
      </div>

      {mic.enabled ? (
        <div className="flex min-w-0 flex-col gap-3">
          <MicStatus mic={mic} meterRef={meterRef} />
        </div>
      ) : null}
    </fieldset>
  );
}

export function MicStatus({
  mic,
  meterRef,
}: {
  mic: MicSetupState;
  meterRef: RefObject<HTMLDivElement | null>;
}) {
  if (mic.blocked) return <BlockedSteps />;
  if (mic.permission === "granted" && !mic.error) {
    return <LiveMeter mic={mic} meterRef={meterRef} />;
  }
  if (mic.error) {
    // Another problem (no microphone, in use): what to do, and retry.
    return (
      <div className="flex flex-col gap-3">
        <p className="text-base text-warning">{mic.error}</p>
        <Button
          type="button"
          variant="outline"
          size="default"
          className="self-start"
          onClick={mic.clearError}
        >
          <RotateCcw aria-hidden="true" />
          Tentar de novo
        </Button>
      </div>
    );
  }
  // Not allowed yet: explain before the browser asks.
  return (
    <div className="flex flex-col gap-3">
      <p className="text-base text-ink">
        O navegador vai pedir acesso ao microfone. Clique em{" "}
        <strong className="text-ink">Permitir</strong>.
      </p>
      <Button
        type="button"
        variant="outline"
        disabled={mic.requesting}
        onClick={() => void mic.askPermission()}
      >
        {mic.requesting ? (
          <Loader2 className="animate-spin" aria-hidden="true" />
        ) : (
          <Mic aria-hidden="true" />
        )}
        {mic.requesting ? "Esperando você permitir…" : "Permitir microfone"}
      </Button>
    </div>
  );
}

/** Blocked: the step-by-step to unblock, in plain sight. */
function BlockedSteps() {
  return (
    <div className="flex flex-col gap-3 text-base">
      <p className="flex items-start gap-2 font-semibold text-warning">
        <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />O navegador bloqueou o
        microfone neste site.
      </p>
      <ol className="flex list-decimal flex-col gap-1.5 pl-10 text-ink">
        <li>Abra as permissões do site pelo ícone ao lado do endereço.</li>
        <li>
          Em <strong className="text-ink">Microfone</strong>, escolha{" "}
          <strong className="text-ink">Permitir</strong>.
        </li>
        <li>Volte ao teste de microfone. Se a barra não aparecer, recarregue a página.</li>
      </ol>
      <p className="pl-6 text-sm text-ink-muted">
        Você também pode entrar só ouvindo e ligar o microfone depois.
      </p>
    </div>
  );
}

/** Allowed: the meter moves with the voice, no testing needed. */
function LiveMeter({
  mic,
  meterRef,
}: {
  mic: MicSetupState;
  meterRef: RefObject<HTMLDivElement | null>;
}) {
  const heard = mic.check === "detected" || mic.check === "confirmed";
  return (
    <>
      {mic.devices.length > 1 ? (
        <MicrophoneSelect
          devices={mic.devices}
          value={mic.deviceId}
          onChange={(value) => mic.choose(value)}
        />
      ) : null}
      <div className="flex min-w-0 items-center gap-3 rounded-xl bg-surface-2 py-2 pr-3 pl-2">
        <output className="flex shrink-0 items-center gap-2.5" aria-live="polite">
          <span
            aria-hidden="true"
            className={cn(
              "grid size-7 shrink-0 place-items-center rounded-lg transition-colors",
              heard ? "bg-brand/15 text-brand-soft" : "bg-surface-3 text-ink-muted",
            )}
          >
            {mic.check === "starting" ? (
              <Loader2 className="size-4 animate-spin motion-reduce:animate-none" />
            ) : mic.check === "waiting" ? (
              <AudioLines className="size-4" />
            ) : (
              <Check className="size-4" />
            )}
          </span>
          <span
            className={cn(
              "text-sm font-medium whitespace-nowrap",
              heard ? "text-brand-soft" : "text-ink-muted",
            )}
          >
            {CHECK_TEXT[mic.check]}
          </span>
        </output>
        <div
          aria-hidden="true"
          className="mic-meter relative h-3.5 min-w-16 flex-1 overflow-hidden bg-ink/12"
        >
          {/*
           * Starts empty via inline `transform`, the same one the hook writes. Do not use
           * `scale-x-0`: in Tailwind 4 it becomes the `scale` property, which adds to
           * `transform` and kept the fill stuck at zero.
           */}
          <div
            ref={meterRef}
            style={{ transform: "scaleX(0)" }}
            className="absolute inset-0 origin-left bg-linear-to-r from-brand to-brand-soft"
          />
        </div>
      </div>
    </>
  );
}

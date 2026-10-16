import { Headphones, Square } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { callToast as toast } from "@/features/room/client/call-notices";
import { Button } from "@/components/ui/button";
import { currentMicrophone } from "@/features/room/client/saved-microphone";
import { captureMicrophone } from "@/features/room/client/microphone-preview";
import { routeToChosenOutput } from "@/features/room/audio/chosen-output";
import { useSavedAudioProcessing } from "@/features/room/hooks/use-saved-audio-processing";
import { ProcessingSwitches } from "@/features/room/ui/settings/ProcessingSwitches";
import { logBrowserWarning } from "@/lib/telemetry.client";
import { useDeafen } from "./Deafen";
import { MicTestContext, useMicTest } from "./mic-test-context";
import { Notice } from "@/components/Notice";

/** The level of a stream, read from the test's own audio context. */
function levelReader(context: AudioContext, source: MediaStreamAudioSourceNode) {
  const analyser = context.createAnalyser();
  analyser.minDecibels = -100;
  analyser.maxDecibels = -80;
  analyser.fftSize = 2048;
  analyser.smoothingTimeConstant = 0.8;
  source.connect(analyser);
  const values = new Uint8Array(analyser.frequencyBinCount);
  return () => {
    analyser.getByteFrequencyData(values);
    const sum = values.reduce((total, value) => total + (value / 255) ** 2, 0);
    return Math.sqrt(sum / values.length);
  };
}

/**
 * While testing: the person's own voice, with the chosen clean-up, played back to them
 * through an audio context opened by the click on "Testar microfone" (browsers that block
 * autoplay, like Brave, allow it then), and the level in the bar. A changed switch restarts
 * the capture with the new clean-up.
 */
function useLoopback(context: AudioContext | null, meterRef: RefObject<HTMLDivElement | null>) {
  const processing = useSavedAudioProcessing();
  useEffect(() => {
    if (!context) return;
    let stopped = false;
    let track: MediaStreamTrack | undefined;
    let source: MediaStreamAudioSourceNode | undefined;
    let frame = 0;

    async function begin(audio: AudioContext) {
      try {
        track = await captureMicrophone({ deviceId: await currentMicrophone(), ...processing });
        if (stopped) {
          track.stop();
          return;
        }
        source = audio.createMediaStreamSource(new MediaStream([track]));
        source.connect(audio.destination);
        const level = levelReader(audio, source);
        const meter = () => {
          if (stopped) return;
          const volume = Math.min(1, level() * 4);
          if (meterRef.current) meterRef.current.style.transform = `scaleX(${Math.sqrt(volume)})`;
          frame = requestAnimationFrame(meter);
        };
        meter();
      } catch (error) {
        logBrowserWarning("Could not start the microphone test", error);
        toast.error("Não foi possível testar o microfone. Confira se ele está conectado.");
      }
    }

    void begin(context);
    return () => {
      stopped = true;
      cancelAnimationFrame(frame);
      source?.disconnect();
      track?.stop();
    };
  }, [context, processing, meterRef]);
}

/**
 * "Testar microfone" inside the call: nobody hears the person and the room goes quiet
 * (the same "stop hearing" as the headphones, which also turns the microphone off), while
 * they hear their own voice. Stopping puts the microphone and the sound back as they were.
 */
export function MicTestProvider({ children }: { children: ReactNode }) {
  const deafen = useDeafen();
  const [testing, setTesting] = useState(false);
  const [busy, setBusy] = useState(false);
  const wasDeafened = useRef(false);
  const meterRef = useRef<HTMLDivElement>(null);
  const [output, setOutput] = useState<AudioContext | null>(null);
  useLoopback(testing ? output : null, meterRef);

  async function start() {
    if (testing || busy) return;
    // Opened and resumed inside the click: playing back is allowed from here on.
    const context = new AudioContext();
    void context.resume();
    void routeToChosenOutput(context);
    setOutput(context);
    setBusy(true);
    wasDeafened.current = deafen.deafened;
    if (!deafen.deafened) await deafen.toggle({ silent: true });
    setTesting(true);
    setBusy(false);
  }

  async function stop() {
    if (!testing || busy) return;
    setBusy(true);
    setTesting(false);
    void output?.close();
    setOutput(null);
    if (!wasDeafened.current) await deafen.toggle({ silent: true });
    setBusy(false);
  }

  // Turning the microphone on already brings the sound back (hearAgain): only the test ends.
  function endForCall() {
    if (!testing) return;
    setTesting(false);
    void output?.close();
    setOutput(null);
  }

  return (
    <MicTestContext
      value={{
        testing,
        busy,
        start,
        stop,
        endForCall,
        attachMeter: (meter) => {
          meterRef.current = meter;
        },
      }}
    >
      {children}
    </MicTestContext>
  );
}

/** The microphone menu while testing: what is happening, the level, the switches, stop. */
export function MicTestPanel() {
  const { busy, stop, attachMeter } = useMicTest();
  return (
    <div className="flex flex-col gap-3 p-1">
      <div>
        <p className="text-sm font-semibold text-ink-muted">Teste do microfone</p>
        <p className="mt-1 text-sm text-ink-muted">
          Ninguém te ouve e o som da sala está desligado. Você ouve a própria voz, já com a limpeza
          escolhida.
        </p>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-control" aria-hidden="true">
        <div
          ref={attachMeter}
          // Not `scale-x-0`: in Tailwind 4 it is the `scale` property, which multiplies the
          // transform written here every frame and keeps the bar at zero.
          style={{ transform: "scaleX(0)" }}
          className="h-full origin-left rounded-full bg-brand transition-transform duration-75"
        />
      </div>
      <Notice tone="warning" icon={Headphones} className="gap-2 px-3 py-2 text-warning">
        Use fone para não microfonar.
      </Notice>
      <ProcessingSwitches />
      <Button
        type="button"
        disabled={busy}
        onClick={() => void stop()}
        className="bg-danger text-canvas hover:bg-danger/90"
      >
        <Square aria-hidden="true" />
        Parar teste
      </Button>
    </div>
  );
}

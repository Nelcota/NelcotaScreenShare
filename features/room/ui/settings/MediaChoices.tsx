import { Camera, Loader2, Mic, Square, Volume2 } from "lucide-react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  saveCamera,
  saveOutput,
  savedCamera,
  savedOutput,
} from "@/features/room/client/saved-media";
import { useMicSetup } from "@/features/room/hooks/use-mic-setup";
import { MicStatus } from "@/features/room/ui/prejoin/MicSetup";
import { subscribeNothing } from "@/lib/hooks/subscribe-nothing";
import { logBrowserWarning } from "@/lib/telemetry.client";
import { DeviceSelect } from "./DeviceSelect";
import { canChooseOutput, playTestTone } from "./test-tone";
import { ProcessingSwitches } from "./ProcessingSwitches";
import { useMediaDevices } from "./use-media-devices";

/** Browser-only settings: nothing renders before hydration (the server cannot know them). */
function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribeNothing,
    () => true,
    () => false,
  );
}

/** The microphone test of the pre-join screen, started only on request. */
function MicrophoneTestBody() {
  const [testing, setTesting] = useState(false);
  const meterRef = useRef<HTMLDivElement>(null);
  const mic = useMicSetup(!testing, meterRef);

  if (!testing) {
    return (
      <Button type="button" variant="outline" onClick={() => setTesting(true)}>
        <Mic aria-hidden="true" />
        Testar microfone
      </Button>
    );
  }
  return (
    <div className="flex min-w-0 flex-col gap-3">
      <MicStatus mic={mic} meterRef={meterRef} />
      <Button
        type="button"
        variant="ghost"
        className="self-start"
        onClick={() => setTesting(false)}
      >
        <Square aria-hidden="true" />
        Parar teste
      </Button>
    </div>
  );
}

function OutputChoiceBody() {
  const devices = useMediaDevices("audiooutput");
  const [output, setOutput] = useState(savedOutput);
  const [playing, setPlaying] = useState(false);
  const choosable = canChooseOutput();

  async function test() {
    setPlaying(true);
    try {
      await playTestTone(choosable ? output : undefined);
    } catch (error) {
      logBrowserWarning("Could not play the test sound", error);
      toast.error("Não foi possível tocar o som. Confira a saída escolhida.");
    } finally {
      setPlaying(false);
    }
  }

  return (
    <div className="flex min-w-0 flex-col gap-3">
      {choosable ? (
        <DeviceSelect
          label="Saída de som"
          devices={devices}
          value={output}
          onChange={(deviceId) => {
            setOutput(deviceId);
            saveOutput(deviceId);
          }}
        />
      ) : (
        <p className="text-sm text-ink-muted">Neste navegador, o som sai pelo padrão do sistema.</p>
      )}
      <Button
        type="button"
        variant="outline"
        className="self-start"
        disabled={playing}
        onClick={() => void test()}
      >
        {playing ? (
          <Loader2 className="animate-spin" aria-hidden="true" />
        ) : (
          <Volume2 aria-hidden="true" />
        )}
        Testar som
      </Button>
    </div>
  );
}

/** Mirrored, as the person sees themself in the call. Stops when hidden or closed. */
function CameraPreview({ deviceId }: { deviceId: string | undefined }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let stream: MediaStream | undefined;
    let disposed = false;
    const start = async () => {
      try {
        const captured = await navigator.mediaDevices.getUserMedia({
          video: deviceId ? { deviceId: { exact: deviceId } } : true,
        });
        if (disposed) {
          for (const track of captured.getTracks()) track.stop();
          return;
        }
        stream = captured;
        if (videoRef.current) videoRef.current.srcObject = captured;
        setFailed(false);
      } catch (error) {
        logBrowserWarning("Could not open the camera preview", error);
        if (!disposed) setFailed(true);
      }
    };
    void start();
    return () => {
      disposed = true;
      for (const track of stream?.getTracks() ?? []) track.stop();
    };
  }, [deviceId]);

  if (failed) {
    return (
      <p className="text-sm text-warning">
        Não foi possível abrir a câmera. Confira a permissão do site.
      </p>
    );
  }
  return (
    <video
      ref={videoRef}
      autoPlay
      muted
      playsInline
      aria-label="Prévia da câmera"
      className="aspect-video w-full max-w-sm -scale-x-100 rounded-xl border border-line bg-black object-cover"
    />
  );
}

function CameraChoiceBody() {
  const [previewing, setPreviewing] = useState(false);
  // Names come after the first permission: listing again once the preview opens.
  const devices = useMediaDevices("videoinput", previewing ? 1 : 0);
  const [camera, setCamera] = useState(savedCamera);

  return (
    <div className="flex min-w-0 flex-col gap-3">
      {devices.length > 1 ? (
        <DeviceSelect
          label="Câmera"
          devices={devices}
          value={camera}
          onChange={(deviceId) => {
            setCamera(deviceId);
            saveCamera(deviceId);
          }}
        />
      ) : null}
      {previewing ? <CameraPreview deviceId={camera} /> : null}
      <Button
        type="button"
        variant="outline"
        className="self-start"
        aria-pressed={previewing}
        onClick={() => setPreviewing(!previewing)}
      >
        {previewing ? <Square aria-hidden="true" /> : <Camera aria-hidden="true" />}
        {previewing ? "Fechar prévia" : "Ver câmera"}
      </Button>
    </div>
  );
}

function ProcessingChoiceBody() {
  return <ProcessingSwitches />;
}

/*
 * The pieces of "Áudio e vídeo" in the account. Each one renders only in the browser:
 * the server cannot know the devices or what this browser saved.
 */

export function MicrophoneTest() {
  return useHydrated() ? <MicrophoneTestBody /> : null;
}

export function OutputChoice() {
  return useHydrated() ? <OutputChoiceBody /> : null;
}

export function CameraChoice() {
  return useHydrated() ? <CameraChoiceBody /> : null;
}

export function ProcessingChoice() {
  return useHydrated() ? <ProcessingChoiceBody /> : null;
}

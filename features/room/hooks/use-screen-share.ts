import { useLocalParticipant } from "@livekit/components-react";
import { ScreenSharePresets, Track, type LocalTrack, type VideoEncoding } from "livekit-client";
import { useEffect, useState } from "react";
import { useRoomHost } from "@/features/room/ui/call/RoomHostProvider";
import { callToast as toast } from "@/features/room/client/call-notices";
import { captureScreenTracks } from "@/features/room/client/screen-capture";
import {
  canRestrictOwnAudio,
  capturesCall,
  computerAudioOptions,
  echoesRoomAudio,
  shareSupportMessage,
  showsCaptureBar,
  surfaceHasAudio,
  type ShareChoice,
  type ShareSurface,
} from "@/features/room/domain/share-support";
import { useShareSupport } from "@/features/room/hooks/use-share-support";
import { reportBrowserError } from "@/lib/telemetry.client";
import { resolveShareProfile, type ShareProfile } from "@/features/room/domain/share-profile";
import { savedShareProfile, saveShareProfile } from "@/features/room/client/saved-share-profile";

const ECHO_NOTICE =
  "O som do computador ficou de fora para não gerar eco. Para compartilhar som, escolha uma aba.";
const CALL_TAB_NOTICE = "O som da aba ficou de fora: ela está numa chamada do Nelcota.";

type CapturedTrack = MediaStreamTrack & {
  getCaptureHandle?: () => { handle?: string } | null;
};

/** Is this capture a Nelcota tab in a call? Chromium only; elsewhere, no. */
function capturedCall(video: LocalTrack | undefined): boolean {
  const track: CapturedTrack | undefined = video?.mediaStreamTrack;
  return capturesCall(track?.getCaptureHandle?.());
}

/**
 * Drops the computer audio when it would carry the room back to everyone (see
 * `echoesRoomAudio`). Checked before publishing, so nobody hears even a moment of it.
 */
function withoutEchoingAudio(tracks: LocalTrack[]): LocalTrack[] {
  const audio = tracks.find((track) => track.source === Track.Source.ScreenShareAudio);
  if (audio === undefined) return tracks;
  const video = tracks.find((track) => track.source === Track.Source.ScreenShare);
  const surface = video?.mediaStreamTrack.getSettings().displaySurface;
  const audioSettings: MediaTrackSettings & { restrictOwnAudio?: boolean } =
    audio.mediaStreamTrack.getSettings();
  const callTab = capturedCall(video);
  if (!echoesRoomAudio(surface, audioSettings.restrictOwnAudio, callTab)) return tracks;

  audio.stop();
  toast.info(callTab ? CALL_TAB_NOTICE : ECHO_NOTICE);
  return tracks.filter((track) => track !== audio);
}

/**
 * Sound was asked for and the surface carries it, but the picker's audio option was
 * left unchecked: without a word, the share would just go silent.
 */
function warnIfAudioLeftOut(tracks: LocalTrack[], audioRequested: boolean) {
  if (!audioRequested) return;
  if (tracks.some((track) => track.source === Track.Source.ScreenShareAudio)) return;
  const video = tracks.find((track) => track.source === Track.Source.ScreenShare);
  const surface = video?.mediaStreamTrack.getSettings().displaySurface;
  if (!isShareSurface(surface) || !surfaceHasAudio(surface, canRestrictOwnAudio())) return;
  toast.info(
    "O compartilhamento foi sem som. Para levar o som, marque a opção de áudio no seletor do navegador.",
  );
}

function isShareSurface(surface: string | undefined): surface is ShareSurface {
  return surface === "monitor" || surface === "window" || surface === "browser";
}

/**
 * Starting and stopping screen sharing. One instance per room
 * (RoomLayout), passed to the dock and to the "Compartilhar minha tela" shown when
 * alone: that way there is a single `busy` and two pickers cannot be opened.
 */
export function useScreenShare() {
  const { localParticipant, isScreenShareEnabled } = useLocalParticipant();
  const [busy, setBusy] = useState(false);
  // Sound preference shared by the dock menu and the alone screen.
  const [audioPreferred, setAudioPreferred] = useState(true);
  const [profile, setProfile] = useState<ShareProfile>(savedShareProfile);
  const support = useShareSupport();
  const host = useRoomHost();
  useEffect(() => {
    if (host.canShare || !isScreenShareEnabled) return;
    void localParticipant.setScreenShareEnabled(false).catch(reportBrowserError);
  }, [host.canShare, isScreenShareEnabled, localParticipant]);
  const sharedSurface = isScreenShareEnabled
    ? localParticipant
        .getTrackPublication(Track.Source.ScreenShare)
        ?.track?.mediaStreamTrack.getSettings().displaySurface
    : undefined;

  /**
   * "Compartilhar esta aba" can move the capture to a tab in a call, or that tab can join
   * one later: its sound comes off at that moment.
   */
  function dropAudioOnCallTab(tracks: LocalTrack[]) {
    const video = tracks.find((track) => track.source === Track.Source.ScreenShare);
    const audio = tracks.find((track) => track.source === Track.Source.ScreenShareAudio);
    if (!video || !audio) return;
    const capture = video.mediaStreamTrack;
    const onHandleChange = () => {
      if (!capturedCall(video)) return;
      capture.removeEventListener("capturehandlechange", onHandleChange);
      toast.info(CALL_TAB_NOTICE);
      void localParticipant.unpublishTrack(audio).catch(reportBrowserError);
    };
    capture.addEventListener("capturehandlechange", onHandleChange);
  }

  /** Publishes the screen and its sound; if one fails, nothing stays captured or half-shared. */
  async function publishScreen(tracks: LocalTrack[], encoding: VideoEncoding) {
    try {
      await Promise.all(
        tracks.map((track) =>
          localParticipant.publishTrack(track, { screenShareEncoding: encoding }),
        ),
      );
    } catch (error) {
      await Promise.allSettled(tracks.map((track) => localParticipant.unpublishTrack(track)));
      for (const track of tracks) track.stop();
      throw error;
    }
  }

  async function start({ surface, audio }: ShareChoice) {
    if (!host.canShare) {
      toast.info("O anfitrião restringiu o compartilhamento de tela.");
      return;
    }
    const options = resolveShareProfile(profile, surface);
    const preset = ScreenSharePresets[options.preset];
    setBusy(true);
    try {
      const tracks = await captureScreenTracks({
        // Opens the browser picker directly on the tab chosen in our menu.
        video: { displaySurface: surface },
        audio: audio
          ? {
              echoCancellation: false,
              noiseSuppression: false,
              autoGainControl: false,
              // System audio also carries the room's own playback: without this,
              // everyone would hear their voice coming back (Chromium only).
              restrictOwnAudio: true,
            }
          : false,
        // Only where the browser can strip the room from it (see `withoutEchoingAudio`).
        ...computerAudioOptions(audio, canRestrictOwnAudio()),
        selfBrowserSurface: "exclude",
        surfaceSwitching: "include",
        contentHint: options.contentHint,
        resolution: preset.resolution,
      });
      warnIfAudioLeftOut(tracks, audio);
      const published = withoutEchoingAudio(tracks);
      await publishScreen(published, preset.encoding);
      dropAudioOnCallTab(published);
    } catch (error) {
      if (error instanceof DOMException && error.name === "NotAllowedError") {
        toast.info(
          "O compartilhamento foi cancelado ou bloqueado. Tente de novo e confirme a tela no navegador.",
        );
        return;
      }
      if (error instanceof DOMException && error.name === "NotSupportedError") {
        toast.error(shareSupportMessage("unsupported"));
        return;
      }
      reportBrowserError(error);
      toast.error(
        "Não foi possível compartilhar a tela. Tente de novo e confirme a tela no seletor do navegador.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function stop() {
    setBusy(true);
    try {
      await localParticipant.setScreenShareEnabled(false);
    } catch (error) {
      reportBrowserError(error);
      toast.error(
        "Não foi possível parar o compartilhamento. Tente de novo ou use o botão Parar compartilhamento do navegador.",
      );
    } finally {
      setBusy(false);
    }
  }

  return {
    isSharing: isScreenShareEnabled,
    permitted: host.canShare,
    /** The browser's own sharing bar covers the bottom of the page. */
    captureBar: support !== null && showsCaptureBar(support, sharedSurface),
    busy,
    audio: audioPreferred,
    setAudio: setAudioPreferred,
    profile,
    setProfile: (next: ShareProfile) => {
      setProfile(next);
      saveShareProfile(next);
    },
    start,
    stop,
  };
}

export type ScreenShareControl = ReturnType<typeof useScreenShare>;

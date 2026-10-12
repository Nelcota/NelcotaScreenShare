import { useLocalParticipant } from "@livekit/components-react";
import { ScreenSharePresets, Track, type LocalTrack, type VideoEncoding } from "livekit-client";
import { useEffect, useState } from "react";
import { useRoomHost } from "@/features/room/ui/call/RoomHostProvider";
import { toast } from "sonner";
import {
  canRestrictOwnAudio,
  echoesRoomAudio,
  shareSupportMessage,
  showsCaptureBar,
  type ShareChoice,
} from "@/features/room/domain/share-support";
import { useShareSupport } from "@/features/room/hooks/use-share-support";
import { reportBrowserError } from "@/lib/telemetry.client";
import { resolveShareProfile, type ShareProfile } from "@/features/room/domain/share-profile";
import { savedShareProfile, saveShareProfile } from "@/features/room/client/saved-share-profile";

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
  if (!echoesRoomAudio(surface, audioSettings.restrictOwnAudio)) return tracks;

  audio.stop();
  toast.info(
    "O som do computador ficou de fora: ele levaria a voz da sala de volta para todos. Para compartilhar som, escolha uma aba.",
  );
  return tracks.filter((track) => track !== audio);
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
      const tracks = await localParticipant.createScreenTracks({
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
        systemAudio: audio && canRestrictOwnAudio() ? "include" : "exclude",
        selfBrowserSurface: "exclude",
        surfaceSwitching: "include",
        contentHint: options.contentHint,
        resolution: preset.resolution,
      });
      await publishScreen(withoutEchoingAudio(tracks), preset.encoding);
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

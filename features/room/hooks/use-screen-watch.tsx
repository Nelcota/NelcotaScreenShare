import { useRoomContext } from "@livekit/components-react";
import {
  ConnectionState,
  RoomEvent,
  Track,
  TrackPublication,
  type RemoteParticipant,
  type Room,
} from "livekit-client";
import {
  createContext,
  use,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { keepPublished, wantsTrack } from "@/features/room/domain/screen-watch";

type FocusPlace = "stage" | "invite";

interface ScreenWatch {
  isWatching: (trackSid: string) => boolean;
  watch: (trackSid: string) => void;
  stopWatching: (trackSid: string) => void;
  /**
   * After "Assistir" the focus goes to the stage; after "Parar de assistir", back to that
   * screen's "Assistir". True once, for the element that should take it.
   */
  takeFocus: (trackSid: string, place: FocusPlace) => boolean;
}

const ScreenWatchContext = createContext<ScreenWatch | null>(null);

const SCREEN_SOURCES: ReadonlySet<Track.Source> = new Set([
  Track.Source.ScreenShare,
  Track.Source.ScreenShareAudio,
]);

function screenSidOf(participant: RemoteParticipant): string | undefined {
  return participant.getTrackPublication(Track.Source.ScreenShare)?.trackSid;
}

function publishedScreens(room: Room): ReadonlySet<string> {
  const sids = [...room.remoteParticipants.values()].map(screenSidOf);
  return new Set(sids.filter((trackSid): trackSid is string => trackSid !== undefined));
}

/** Subscribes to what this viewer wants and nothing else (the room connects without auto-subscribe). */
function applySubscriptions(room: Room, watched: ReadonlySet<string>) {
  for (const participant of room.remoteParticipants.values()) {
    const screenSid = screenSidOf(participant);
    for (const publication of participant.trackPublications.values()) {
      const fromScreen = SCREEN_SOURCES.has(publication.source);
      const wanted = wantsTrack(fromScreen, screenSid, watched);
      if (wanted && publication.isSubscribed) continue;
      if (
        !wanted &&
        publication.subscriptionStatus === TrackPublication.SubscriptionStatus.Unsubscribed
      )
        continue;
      publication.setSubscribed(wanted);
    }
  }
}

/**
 * Nobody receives someone else's screen by default, as in Discord: "Assistir" brings its
 * video and sound, "Parar de assistir" cuts both and leaves only the call.
 */
export function ScreenWatchProvider({ children }: { children: ReactNode }) {
  const room = useRoomContext();
  const [watched, setWatched] = useState<ReadonlySet<string>>(() => new Set());
  const focusRequest = useRef<{ trackSid: string; place: FocusPlace }>(undefined);

  useEffect(() => {
    const apply = () => applySubscriptions(room, watched);
    // While it reconnects, everyone seems to leave and come back: nothing is forgotten then.
    const forgetEnded = () => {
      if (room.state !== ConnectionState.Connected) return;
      setWatched((current) => keepPublished(current, publishedScreens(room)));
    };
    const settle = () => {
      apply();
      forgetEnded();
    };
    apply();
    room
      .on(RoomEvent.TrackPublished, apply)
      .on(RoomEvent.Connected, apply)
      .on(RoomEvent.Reconnected, settle)
      .on(RoomEvent.TrackUnpublished, forgetEnded)
      .on(RoomEvent.ParticipantDisconnected, forgetEnded);
    return () => {
      room
        .off(RoomEvent.TrackPublished, apply)
        .off(RoomEvent.Connected, apply)
        .off(RoomEvent.Reconnected, settle)
        .off(RoomEvent.TrackUnpublished, forgetEnded)
        .off(RoomEvent.ParticipantDisconnected, forgetEnded);
    };
  }, [room, watched]);

  const state: ScreenWatch = {
    isWatching: (trackSid) => watched.has(trackSid),
    watch: (trackSid) => {
      focusRequest.current = { trackSid, place: "stage" };
      setWatched((current) => new Set(current).add(trackSid));
    },
    stopWatching: (trackSid) => {
      focusRequest.current = { trackSid, place: "invite" };
      setWatched((current) => new Set([...current].filter((sid) => sid !== trackSid)));
    },
    takeFocus: (trackSid, place) => {
      const request = focusRequest.current;
      if (request?.trackSid !== trackSid || request.place !== place) return false;
      focusRequest.current = undefined;
      return true;
    },
  };
  return <ScreenWatchContext value={state}>{children}</ScreenWatchContext>;
}

export function useScreenWatch(): ScreenWatch {
  const state = use(ScreenWatchContext);
  if (state === null) throw new Error("useScreenWatch must be used inside ScreenWatchProvider");
  return state;
}

/** Right after "Assistir", the focus lands on the stage showing that screen. */
export function useStageFocusAfterWatch(trackSid: string): RefObject<HTMLElement | null> {
  const stageRef = useRef<HTMLElement>(null);
  const { takeFocus } = useScreenWatch();
  const focusIfAsked = useEffectEvent((sid: string) => {
    if (takeFocus(sid, "stage")) stageRef.current?.focus();
  });
  useEffect(() => focusIfAsked(trackSid), [trackSid]);
  return stageRef;
}

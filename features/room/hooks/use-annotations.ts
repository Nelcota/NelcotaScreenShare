import { useDataChannel, useRoomContext } from "@livekit/components-react";
import { useCallback, useEffect, useEffectEvent, useRef, useState, type RefObject } from "react";
import { callToast as toast } from "@/features/room/client/call-notices";
import { useRoomHost } from "@/features/room/ui/call/RoomHostProvider";
import {
  acceptAnnotation,
  ANNOTATION_BYTES,
  annotationMessageSchema,
  annotationStateSchema,
  type AnnotationMark,
  type AnnotationMessage,
  type AnnotationPoint,
  type AnnotationState,
  type AnnotationTool,
} from "@/features/room/domain/annotations";
import {
  createReceiveThrottle,
  decodeMessage,
  encodeMessage,
  TOPICS,
} from "@/features/room/domain/data-channel";
import { participantName } from "@/features/room/domain/participant-label";

export function useAnnotations(
  trackSid: string,
  videoRef: RefObject<HTMLVideoElement | null>,
  ownScreen: boolean,
) {
  const room = useRoomContext();
  const { roomCode, sessionId } = useRoomHost();
  const scope = `${sessionId}/${trackSid}`;
  const [saved, setSaved] = useState<{ scope: string; state: AnnotationState }>();
  const state = saved?.scope === scope ? saved.state : undefined;
  const [marks, setMarks] = useState<AnnotationMark[]>([]);
  const [selectedTool, selectTool] = useState<{ scope: string; tool?: AnnotationTool }>();
  const tool = selectedTool?.scope === scope ? selectedTool.tool : undefined;
  const setTool = (next: AnnotationTool | undefined) => selectTool({ scope, tool: next });
  const [refresh, setRefresh] = useState(0);
  const current = useRef(saved);
  const activeScope = useRef<string | undefined>(scope);
  useEffect(() => {
    activeScope.current = scope;
    return () => {
      activeScope.current = undefined;
    };
  }, [scope]);
  const lastPreview = useRef(0);
  const [throttle] = useState(() => createReceiveThrottle(40));
  const [controlThrottle] = useState(() => createReceiveThrottle(1_000));
  const input = roomCode && sessionId ? { room: roomCode, sessionId, trackSid } : undefined;
  const apply = useCallback(
    (next: AnnotationState) => {
      if (activeScope.current !== scope) return;
      const previous = current.current?.scope === scope ? current.current.state : undefined;
      if (previous && next.revision < previous.revision) return;
      if (previous?.epoch !== next.epoch) setMarks([]);
      current.current = { scope, state: next };
      setSaved({ scope, state: next });
    },
    [scope],
  );
  const { send } = useDataChannel(TOPICS.annotation, (packet) => {
    const sender = packet.from;
    if (
      !sender ||
      current.current?.scope !== scope ||
      !sessionId ||
      packet.payload.byteLength > ANNOTATION_BYTES
    )
      return;
    const message = decodeMessage(packet.payload, annotationMessageSchema);
    if (
      !message ||
      !throttle(`${sender.identity}/${message.kind}/${message.kind === "mark" && message.preview}`)
    )
      return;
    setMarks((list) =>
      acceptAnnotation(
        list,
        message,
        sender.identity,
        participantName(sender),
        { sessionId, trackSid, epoch: current.current?.state.epoch ?? "" },
        Date.now(),
      ),
    );
  });
  useDataChannel(TOPICS.annotationEpoch, (packet) => {
    if (packet.from || !controlThrottle("server")) return;
    // Notifications only trigger an authenticated reread; packets cannot grant clearing power.
    setRefresh((value) => value + 1);
  });

  useEffect(() => {
    if (!roomCode || !sessionId) return;
    const abort = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const response = await fetch(
          `/api/sala/anotacoes?${new URLSearchParams({ room: roomCode, sessionId, trackSid, refresh: String(refresh) })}`,
          { signal: abort.signal },
        );
        if (!response.ok) {
          current.current = undefined;
          setSaved(undefined);
          setMarks([]);
          return;
        }
        const parsed = annotationStateSchema.safeParse(await response.json());
        if (parsed.success && !abort.signal.aborted) apply(parsed.data);
      } catch {
        /* Video playback remains independent from annotation state. */
      } finally {
        if (!abort.signal.aborted) timer = setTimeout(() => void poll(), 1_500);
      }
    };
    void poll();
    return () => {
      abort.abort();
      clearTimeout(timer);
    };
  }, [roomCode, sessionId, trackSid, refresh, apply]);
  useEffect(() => {
    const timer = setInterval(
      () => setMarks((list) => list.filter((mark) => mark.expiresAt > Date.now())),
      500,
    );
    return () => clearInterval(timer);
  }, []);

  async function clear() {
    if (!input || !state?.canClear) return;
    try {
      const response = await fetch("/api/sala/anotacoes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!response.ok) {
        toast.error("Não foi possível limpar as anotações.");
        return;
      }
      apply(annotationStateSchema.parse(await response.json()));
    } catch {
      toast.error("Não foi possível limpar as anotações.");
    }
  }
  const sourceChanged = useEffectEvent(() => {
    setMarks([]);
    if (ownScreen) void clear();
  });
  useEffect(() => {
    if (!ownScreen) return;
    let fingerprint: string | undefined;
    const timer = setInterval(() => {
      const track = videoRef.current?.srcObject;
      if (!(track instanceof MediaStream)) return;
      const video = track.getVideoTracks()[0];
      if (!video) return;
      const settings = video.getSettings();
      const next = `${video.id}/${video.label}/${settings.width}/${settings.height}/${settings.displaySurface}`;
      if (fingerprint !== undefined && fingerprint !== next) sourceChanged();
      fingerprint = next;
    }, 1_000);
    return () => clearInterval(timer);
  }, [ownScreen, videoRef]);

  function publish(message: AnnotationMessage) {
    if (!sessionId || !state) return;
    setMarks((list) =>
      acceptAnnotation(
        list,
        message,
        room.localParticipant.identity,
        "Você",
        { sessionId, trackSid, epoch: state.epoch },
        Date.now(),
      ),
    );
    void send(encodeMessage(message), {
      reliable: message.kind === "remove" || !message.preview,
    }).catch(() => toast.error("Não foi possível enviar a anotação."));
  }
  function draw(
    id: string,
    shape: AnnotationTool,
    points: AnnotationPoint[],
    createdAt: number,
    preview: boolean,
  ) {
    if (!sessionId || !state) return;
    if (preview && Date.now() - lastPreview.current < 100) return;
    if (preview) lastPreview.current = Date.now();
    publish({
      v: 1,
      sessionId,
      trackSid,
      epoch: state.epoch,
      id,
      kind: "mark",
      shape,
      points: preview ? points.slice(-8) : points.slice(0, 64),
      createdAt,
      preview,
    });
  }
  function removeOwn() {
    const last = marks.findLast(
      (mark) => mark.author === room.localParticipant.identity && !mark.preview,
    );
    if (!last || !sessionId || !state) return;
    publish({ v: 1, sessionId, trackSid, epoch: state.epoch, id: last.id, kind: "remove" });
  }
  return {
    marks: marks.filter((mark) => mark.trackSid === trackSid && mark.sessionId === sessionId),
    tool,
    setTool,
    draw,
    removeOwn,
    clear,
    available: Boolean(state && sessionId),
    canClear: state?.canClear ?? false,
  };
}
export type AnnotationControl = ReturnType<typeof useAnnotations>;

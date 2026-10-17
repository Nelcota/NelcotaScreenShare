import { useEffect, useEffectEvent, useRef, useState, type RefObject } from "react";
import { callToast as toast } from "@/features/room/client/call-notices";
import { gsap, MOTION_DURATION, useGSAP } from "@/lib/animation/gsap";
import type { ChatEntry, ChatState } from "@/features/room/hooks/use-chat-state";
import { UnexpectedConnectionState } from "livekit-client";
import { logBrowserWarning, reportUnlessNetworkFailure } from "@/lib/telemetry.client";

/** A message sent while the room is reconnecting fails as expected: the toast is enough. */
function reportChatFailure(error: unknown) {
  if (error instanceof UnexpectedConnectionState) {
    logBrowserWarning("Chat message failed while disconnected:", error);
    return;
  }
  reportUnlessNetworkFailure("Chat message failed:", error);
}

/** Slides the panel in and out as the chat opens and closes. */
export function useChatPanelMotion(
  scope: RefObject<HTMLElement | null>,
  open: boolean,
  reducedMotion: boolean,
) {
  useGSAP(
    () => {
      const panel = scope.current;
      if (!panel) return;
      gsap.set(panel, { x: 16, autoAlpha: 0 });
    },
    { scope },
  );

  useGSAP(
    () => {
      const panel = scope.current;
      if (!panel) return;
      gsap.to(panel, {
        x: reducedMotion || open ? 0 : 16,
        autoAlpha: open ? 1 : 0,
        duration: reducedMotion ? 0 : MOTION_DURATION.surface,
        overwrite: "auto",
      });
    },
    { scope, dependencies: [open, reducedMotion] },
  );
}

/** Keeps the list at the end while the person follows along and counts what they missed. */
export function useChatScroll(
  chat: ChatState,
  listRef: RefObject<HTMLOListElement | null>,
  inputRef: RefObject<HTMLTextAreaElement | null>,
) {
  // Scrolled up to read: new messages do not pull the list down.
  const [atBottom, setAtBottom] = useState(true);
  const [missed, setMissed] = useState(0);

  useEffect(() => {
    if (!chat.open) return;
    inputRef.current?.focus();
    // Focus and the panel's first layout can change its scrollable height.
    const frame = requestAnimationFrame(() => {
      const list = listRef.current;
      list?.scrollTo({ top: list.scrollHeight });
    });
    return () => cancelAnimationFrame(frame);
  }, [chat.open, inputRef, listRef]);

  function scrollToEnd(behavior: ScrollBehavior = "auto") {
    const list = listRef.current;
    list?.scrollTo({ top: list.scrollHeight, behavior });
    setMissed(0);
  }

  // New message: follows along if the person is at the bottom (or if they sent it).
  const count = chat.messages.length;
  const seenCount = useRef(count);
  const onArrival = useEffectEvent((added: number) => {
    if (atBottom || chat.messages.at(-1)?.mine) {
      scrollToEnd();
      return;
    }
    setMissed((value) => value + added);
  });
  useEffect(() => {
    const added = count - seenCount.current;
    seenCount.current = count;
    if (added > 0) onArrival(added);
  }, [count]);

  function handleScroll(list: HTMLOListElement) {
    const bottom = list.scrollHeight - list.scrollTop - list.clientHeight < 48;
    setAtBottom(bottom);
    if (bottom) setMissed(0);
  }

  return { missed, scrollToEnd, handleScroll };
}

/** Draft, editing and deleting of the person's messages. */
export function useChatEditing(chat: ChatState, inputRef: RefObject<HTMLTextAreaElement | null>) {
  const [draft, setDraft] = useState("");
  const [editingId, setEditingId] = useState<string>();
  const [deletingId, setDeletingId] = useState<string>();
  const [busy, setBusy] = useState(false);
  const editing = chat.messages.find((message) => message.id === editingId && !message.deleted);

  function focusInput() {
    // After React applies the text: caret at the end, ready to continue.
    requestAnimationFrame(() => {
      const input = inputRef.current;
      if (!input) return;
      input.focus();
      input.setSelectionRange(input.value.length, input.value.length);
    });
  }

  function startEditing(entry: ChatEntry) {
    setEditingId(entry.id);
    setDraft(entry.text);
    focusInput();
  }

  function cancelEditing() {
    setEditingId(undefined);
    setDraft("");
    focusInput();
  }

  /** Up arrow with an empty field: edits your last message. */
  function editLast() {
    // Images are never edited: the last text of yours is.
    const last = chat.messages.findLast(
      (message) => message.mine && !message.deleted && message.image === undefined,
    );
    if (last) startEditing(last);
    return last !== undefined;
  }

  async function submit() {
    const text = draft.trim();
    if (!text || chat.isSending || busy) return;
    if (editing && text === editing.text) {
      cancelEditing();
      return;
    }
    setBusy(true);
    try {
      if (editing) {
        await chat.edit(editing.id, text);
        cancelEditing();
        return;
      }
      await chat.send(text);
      setDraft("");
      inputRef.current?.focus();
    } catch (error) {
      reportChatFailure(error);
      toast.error(
        editing
          ? "Não foi possível editar a mensagem. Tente de novo."
          : "Não foi possível enviar a mensagem. Tente de novo.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function confirmDelete() {
    const id = deletingId;
    if (!id) return;
    setBusy(true);
    try {
      await chat.remove(id);
      if (id === editingId) cancelEditing();
      setDeletingId(undefined);
    } catch (error) {
      reportChatFailure(error);
      toast.error("Não foi possível apagar a mensagem. Tente de novo.");
    } finally {
      setBusy(false);
    }
  }

  return {
    draft,
    setDraft,
    editingId,
    editing,
    deletingId,
    setDeletingId,
    busy,
    startEditing,
    cancelEditing,
    editLast,
    submit,
    confirmDelete,
  };
}

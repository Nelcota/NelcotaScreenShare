import { useState, type FormEvent, type RefObject } from "react";
import { useNavigate, useRevalidator } from "react-router";
import { upsetMascot } from "@/features/mascot/client/events";
import { requestToken } from "@/features/room/client/api";
import { joinFailure, type JoinChoices } from "@/features/room/domain/join";
import { displayNameSchema } from "@/features/room/domain/participant-label";
import { roomLink } from "@/features/room/domain/room-code";
import type { useGuestName } from "@/features/room/hooks/use-guest-name";
import { gsap, MOTION_DURATION, prefersReducedMotion } from "@/lib/animation/gsap";
import { formText } from "@/lib/utils";
import type { TokenRequest } from "@/features/room/domain/token-contract";
import { useJoinApproval, type ApprovalAnswer } from "./use-join-approval";

type FormField = "password" | "name";

interface JoinFormOptions {
  code: string;
  invite?: string;
  passwordRequired: boolean;
  guest: boolean;
  guestName: ReturnType<typeof useGuestName>;
  scope: RefObject<HTMLFormElement | null>;
  passwordRef: RefObject<HTMLInputElement | null>;
  guestNameRef: RefObject<HTMLInputElement | null>;
  onJoin: (choices: JoinChoices) => void;
  onPrepareJoin?: () => void;
  /** Room code of a call in another tab of this browser: joining asks first. */
  otherTabCall?: string;
  /** Confirmed and about to enter: the other tab leaves its call. */
  onLeaveOtherTab?: () => void;
}

const APPROVAL_ENDINGS: Record<Exclude<ApprovalAnswer, "accepted" | "cancelled">, string> = {
  declined: "Seu pedido não foi aceito.",
  expired: "Ninguém respondeu a tempo. Tente de novo.",
};

/** The microphone choices the room starts with. */
type MicrophoneChoices = Pick<JoinChoices, "micEnabled" | "audioDeviceId">;

/** What the form adds to the token request. */
interface JoinFields {
  password?: string;
  guestName?: string;
}

/** A valid join waiting for the person to confirm leaving the call in another tab. */
interface PendingJoin {
  fields: JoinFields;
  microphone: MicrophoneChoices;
  /** Room of the call in the other tab when the person clicked to join. */
  otherTabCall: string;
}

/** Pre-join form: validates the fields, requests the token and reports what needs fixing. */
export function useJoinForm(options: JoinFormOptions) {
  const { code, invite, passwordRequired, guest, guestName, scope, passwordRef, guestNameRef } =
    options;
  const [formError, setFormError] = useState<{ message: string; field?: FormField }>();
  const [submitting, setSubmitting] = useState(false);
  const [pendingJoin, setPendingJoin] = useState<PendingJoin>();
  const revalidator = useRevalidator();
  const navigate = useNavigate();
  const approval = useJoinApproval();

  /**
   * Requests the token; in a room with approval, waits for the answer and asks again with
   * the accepted request. Returns null when the person cancelled the wait.
   */
  async function requestWithApproval(input: TokenRequest) {
    const first = await requestToken(input);
    if (first.ok || first.code !== "awaiting_approval" || !first.requestId) return first;
    const answer = await approval.waitForApproval(first.requestId);
    if (answer === "cancelled") return null;
    if (answer !== "accepted") {
      return {
        ok: false as const,
        code: "awaiting_approval" as const,
        message: APPROVAL_ENDINGS[answer],
      };
    }
    return requestToken({ ...input, requestId: first.requestId });
  }

  /** Shows the error and moves focus to the field that needs fixing. */
  function showFailure(message: string, failure: ReturnType<typeof joinFailure>) {
    setFormError({ message, field: failure.passwordField ? "password" : undefined });
    if (failure.passwordField) passwordRef.current?.focus();
    upsetMascot(failure.mood, (failure.passwordField && passwordRef.current) || undefined);
    if (!prefersReducedMotion() && scope.current) {
      gsap.to(scope.current, {
        keyframes: [{ x: -4 }, { x: 4 }, { x: 0 }],
        duration: MOTION_DURATION.surface,
        ease: "sine.inOut",
        overwrite: "auto",
      });
    }
  }

  /** Marks the field to fix, focuses it and lets the mascot react. */
  function rejectField(field: FormField, message: string) {
    const ref = field === "name" ? guestNameRef : passwordRef;
    setFormError({ message, field });
    ref.current?.focus();
    upsetMascot("grumpy", ref.current ?? undefined);
  }

  /** What the form adds to the token request, or undefined when a field needs fixing. */
  function readFields(form: HTMLFormElement): JoinFields | undefined {
    const parsedName = guest ? displayNameSchema.safeParse(guestName.name) : undefined;
    if (parsedName && !parsedName.success) {
      rejectField("name", parsedName.error.issues[0]?.message ?? "Digite seu nome.");
      return undefined;
    }
    const password = passwordRequired ? formText(new FormData(form), "password") : undefined;
    if (passwordRequired && !password) {
      rejectField("password", "Digite a senha que recebeu de quem enviou o convite.");
      return undefined;
    }
    return { password, guestName: parsedName?.data };
  }

  /** Session expired or e-mail not verified: that screen, then back to the room. */
  function handleRefusal(error: Parameters<typeof joinFailure>[0], message: string) {
    const failure = joinFailure(error);
    if (failure.redirect) {
      const page = failure.redirect === "login" ? "/entrar" : "/verificar-email";
      // Still before the call: a client navigation, without reloading the whole app.
      void navigate(`${page}?voltar=${encodeURIComponent(roomLink(code, invite))}`);
      return;
    }
    if (failure.reloadRoom) {
      setSubmitting(false);
      void revalidator.revalidate();
      return;
    }
    setSubmitting(false);
    showFailure(message, failure);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>, microphone: MicrophoneChoices) {
    event.preventDefault();
    if (submitting) return;
    const fields = readFields(event.currentTarget);
    if (!fields) return;
    if (options.otherTabCall !== undefined) {
      setPendingJoin({ fields, microphone, otherTabCall: options.otherTabCall });
      return;
    }
    await join(fields, microphone);
  }

  /** Requests the token and enters; `beforeEnter` runs only once the token is granted. */
  async function join(fields: JoinFields, microphone: MicrophoneChoices, beforeEnter?: () => void) {
    setFormError(undefined);
    setSubmitting(true);
    options.onPrepareJoin?.();
    const result = await requestWithApproval({ room: code, invite, ...fields });
    if (!result) {
      setSubmitting(false);
      return;
    }
    if (!result.ok) {
      handleRefusal(result.code, result.message);
      return;
    }

    if (fields.guestName) guestName.remember(fields.guestName);
    beforeEnter?.();
    options.onJoin({
      ...fields,
      token: result.data.token,
      serverUrl: result.data.serverUrl,
      sessionId: result.data.sessionId,
      ...microphone,
    });
  }

  /** The person confirmed: join here and make the other tab leave. */
  function confirmPendingJoin() {
    if (pendingJoin === undefined) return;
    setPendingJoin(undefined);
    void join(pendingJoin.fields, pendingJoin.microphone, options.onLeaveOtherTab);
  }

  return {
    /** Room of the call in another tab the person must confirm leaving, while asking. */
    pendingOtherTabCall: pendingJoin?.otherTabCall,
    confirmPendingJoin,
    cancelPendingJoin: () => setPendingJoin(undefined),
    formError,
    submitting,
    waitingApproval: approval.waiting,
    cancelWaiting: approval.cancel,
    clearError: () => setFormError(undefined),
    handleSubmit,
  };
}

import { useState, type FormEvent, type RefObject } from "react";
import { upsetMascot } from "@/features/mascot/client/events";
import { requestToken } from "@/features/room/client/api";
import { joinFailure, type JoinChoices } from "@/features/room/domain/join";
import { displayNameSchema } from "@/features/room/domain/participant-label";
import { roomLink } from "@/features/room/domain/room-code";
import type { useGuestName } from "@/features/room/hooks/use-guest-name";
import { gsap, MOTION_DURATION, prefersReducedMotion } from "@/lib/animation/gsap";
import { formText } from "@/lib/utils";

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
}

/** The microphone choices the room starts with. */
type MicrophoneChoices = Pick<JoinChoices, "micEnabled" | "audioDeviceId">;

/** Pre-join form: validates the fields, requests the token and reports what needs fixing. */
export function useJoinForm(options: JoinFormOptions) {
  const { code, invite, passwordRequired, guest, guestName, scope, passwordRef, guestNameRef } =
    options;
  const [formError, setFormError] = useState<{ message: string; field?: FormField }>();
  const [submitting, setSubmitting] = useState(false);

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
  function readFields(
    form: HTMLFormElement,
  ): { password?: string; guestName?: string } | undefined {
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
      window.location.assign(`${page}?voltar=${encodeURIComponent(roomLink(code, invite))}`);
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

    setFormError(undefined);
    setSubmitting(true);
    options.onPrepareJoin?.();
    const result = await requestToken({ room: code, invite, ...fields });
    if (!result.ok) {
      handleRefusal(result.code, result.message);
      return;
    }

    if (fields.guestName) guestName.remember(fields.guestName);
    options.onJoin({
      ...fields,
      token: result.data.token,
      serverUrl: result.data.serverUrl,
      sessionId: result.data.sessionId,
      ...microphone,
    });
  }

  return {
    formError,
    submitting,
    clearError: () => setFormError(undefined),
    handleSubmit,
  };
}

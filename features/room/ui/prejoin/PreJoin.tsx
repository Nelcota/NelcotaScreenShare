import { Loader2 } from "lucide-react";
import { useLocation, useViewTransitionState } from "react-router";
import { Button } from "@/components/ui/button";
import { useEffect, useRef, useState, useSyncExternalStore, type RefObject } from "react";
import { subscribeNothing } from "@/lib/hooks/subscribe-nothing";
import type { JoinChoices } from "@/features/room/domain/join";
import type { RoomPresence } from "@/features/room/domain/presence";
import { roomLink } from "@/features/room/domain/room-code";
import { useOtherTabCall } from "@/features/room/hooks/use-call-tabs";
import { useGuestName } from "@/features/room/hooks/use-guest-name";
import { useMicSetup } from "@/features/room/hooks/use-mic-setup";
import { useAutoJoin } from "@/features/room/hooks/use-auto-join";
import { gsap, MOTION_DURATION, MOTION_QUERIES, useGSAP } from "@/lib/animation/gsap";
import { GuestNameRow } from "./GuestNameRow";
import { MicSetup } from "./MicSetup";
import { NameRow } from "./NameRow";
import { PasswordField } from "./PasswordField";
import { OtherTabCallDialog } from "./OtherTabCallDialog";
import { JoinActions, PreJoinHeader } from "./PreJoinSections";
import { useJoinForm } from "./use-join-form";

interface PreJoinProps {
  code: string;
  /** A permanent room's own name ("Daily do time"); null for a one-off room. */
  roomName: string | null;
  /** Signed-in account name: how the person appears in the room. Null for a guest. */
  userName: string | null;
  /** Signed-in account photo (null: none, or a guest). */
  userImage: string | null;
  passwordRequired: boolean;
  /** Dashboard invite: replaces the access password. */
  invite?: string;
  /** People in the room now (null: unknown). */
  presence: RoomPresence | null;
  maxParticipants: number;
  onJoin: (choices: JoinChoices) => void;
  /** Download the call UI while the token request is in flight. */
  onPrepareJoin?: () => void;
  /** Accepted a ring: joins on its own unless the microphone or the password needs them. */
  autoJoin?: boolean;
}

/** Who joins: the account's name (editable), or a guest's name field. */
function IdentityRow({
  userName,
  userImage,
  guestName,
  guestNameRef,
  error,
  signInHref,
  onGuestEdit,
}: {
  userName: string | null;
  userImage: string | null;
  guestName: ReturnType<typeof useGuestName>;
  guestNameRef: RefObject<HTMLInputElement | null>;
  error: { message: string; field?: string } | undefined;
  signInHref: string;
  /** The guest typed: clears the error shown on the field. */
  onGuestEdit: () => void;
}) {
  const [accountName, setAccountName] = useState(userName);
  if (accountName !== null) {
    return <NameRow name={accountName} image={userImage} onChange={setAccountName} />;
  }
  return (
    <GuestNameRow
      inputRef={guestNameRef}
      name={guestName.name}
      error={error?.field === "name" ? error.message : undefined}
      signInHref={signInHref}
      onChange={(value) => {
        guestName.setName(value);
        onGuestEdit();
      }}
    />
  );
}

/** Native submission stays unavailable until the client handler is attached. */
function useJoinDisabled(submitting: boolean) {
  const ready = useSyncExternalStore(
    subscribeNothing,
    () => true,
    () => false,
  );
  return !ready || submitting;
}

/** Card entrance, skipped while a view transition already animates the page. */
function useEntranceAnimation(scope: RefObject<HTMLFormElement | null>) {
  const transitioning = useViewTransitionState(useLocation().pathname);
  useGSAP(
    () => {
      const card = scope.current;
      if (transitioning || !card) return;
      const media = gsap.matchMedia();
      media.add(MOTION_QUERIES.motion, () => {
        gsap.from(card, {
          y: 10,
          opacity: 0,
          duration: MOTION_DURATION.entrance,
          clearProps: "transform,opacity",
        });
      });
    },
    { scope },
  );
}

/** Pre-join: confirms who is joining, tests the microphone, asks for the password and the token. */
/** In a room with approval: the request is out and the owner or a moderator decides. */
function WaitingApproval({ onCancel }: { onCancel: () => void }) {
  return (
    <output className="panel flex w-full flex-col items-center gap-3 rounded-2xl p-5 text-center">
      <Loader2
        className="size-6 animate-spin text-brand-soft motion-reduce:animate-none"
        aria-hidden="true"
      />
      <p className="text-base font-medium">Pedido enviado</p>
      <p className="text-sm text-ink-muted">Aguarde quem cuida da sala aceitar.</p>
      <Button type="button" variant="ghost" onClick={onCancel}>
        Cancelar
      </Button>
    </output>
  );
}

export function PreJoin({
  code,
  roomName,
  userName,
  userImage,
  passwordRequired,
  invite,
  presence,
  maxParticipants,
  onJoin,
  onPrepareJoin,
  autoJoin = false,
}: PreJoinProps) {
  const scope = useRef<HTMLFormElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const guestNameRef = useRef<HTMLInputElement>(null);
  const guest = userName === null;
  const guestName = useGuestName();
  const otherTabCall = useOtherTabCall();
  const form = useJoinForm({
    code,
    invite,
    passwordRequired,
    guest,
    guestName,
    scope,
    passwordRef,
    guestNameRef,
    onJoin,
    onPrepareJoin,
    otherTabCall: otherTabCall.code,
    onLeaveOtherTab: otherTabCall.leaveOtherTabs,
  });
  const { formError, submitting, waitingApproval, cancelWaiting, clearError, handleSubmit } = form;
  const joinDisabled = useJoinDisabled(submitting);
  const meterRef = useRef<HTMLDivElement>(null);
  const mic = useMicSetup(submitting, meterRef);
  useEntranceAnimation(scope);
  // The browser still has to ask about the microphone, or a password is missing: they stay.
  const permissionKnown = mic.permission !== "unknown" && mic.permission !== "prompt";
  useAutoJoin(scope, autoJoin && !guest && !(passwordRequired && !invite) && permissionKnown);

  // Focus starts on the first missing field: the guest's name, else the access password.
  useEffect(() => {
    if (guest && !guestNameRef.current?.value) {
      guestNameRef.current?.focus();
      return;
    }
    passwordRef.current?.focus();
  }, [guest]);

  return (
    <>
      <form
        ref={scope}
        method="post"
        onSubmit={(event) =>
          void handleSubmit(event, {
            // Microphone blocked: join listen-only instead of failing inside.
            micEnabled: !mic.joinsMuted,
            audioDeviceId: mic.deviceId,
          })
        }
        noValidate
        className="flex w-full max-w-lg flex-col items-center gap-5"
      >
        <PreJoinHeader
          code={code}
          roomName={roomName}
          invite={invite}
          presence={presence}
          maxParticipants={maxParticipants}
          guest={guest}
          mic={mic}
          submitting={submitting}
        />

        <div
          data-anim="row"
          className="panel w-full divide-y divide-line overflow-hidden rounded-2xl"
        >
          <IdentityRow
            userName={userName}
            userImage={userImage}
            guestName={guestName}
            guestNameRef={guestNameRef}
            error={formError}
            signInHref={`/entrar?voltar=${encodeURIComponent(roomLink(code, invite))}`}
            onGuestEdit={clearError}
          />
          <MicSetup mic={mic} meterRef={meterRef} />
        </div>

        {passwordRequired ? (
          <PasswordField
            inputRef={passwordRef}
            error={formError?.field === "password" ? formError.message : undefined}
            onChange={clearError}
          />
        ) : null}

        {formError && !formError.field ? (
          <p className="-mt-2 w-full text-center text-base text-danger" role="alert">
            {formError.message}
          </p>
        ) : null}

        {waitingApproval ? (
          <WaitingApproval onCancel={cancelWaiting} />
        ) : (
          <JoinActions
            signedIn={userName !== null}
            mic={mic}
            submitting={submitting}
            joinDisabled={joinDisabled}
            onPrepareJoin={onPrepareJoin}
          />
        )}
      </form>
      {/* Outside the form: the dialog has its own form, and React events bubble through portals. */}
      <OtherTabCallDialog
        code={form.pendingOtherTabCall}
        onConfirm={form.confirmPendingJoin}
        onCancel={form.cancelPendingJoin}
      />
    </>
  );
}

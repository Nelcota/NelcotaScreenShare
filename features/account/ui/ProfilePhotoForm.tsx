import { Camera, ImageUp, Loader2, Trash2 } from "lucide-react";
import { useRevalidator } from "react-router";

import { useId, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { FormError } from "@/components/FormError";
import { UserAvatar } from "@/components/UserAvatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { photoErrorMessage, preparePhoto } from "@/features/account/client/prepare-photo";
import { PROFILE_PHOTO } from "@/features/account/domain/profile-photo";
import { authClient } from "@/features/auth/client/participant-auth-client";
import { authErrorMessage } from "@/features/auth/domain/auth-errors";
import { reportBrowserError } from "@/lib/telemetry.client";

const AVATAR_BUTTON_CLASS =
  "group relative shrink-0 rounded-full outline-none focus-visible:ring-3 focus-visible:ring-brand/60 disabled:opacity-60";

/**
 * Identity card photo: the avatar itself is the control. Without a photo, it opens
 * the file picker; with a photo, a menu to change or remove it. The preview only
 * takes effect after "Salvar foto". `children` is the text beside the avatar.
 */
export function ProfilePhotoForm({
  image,
  children,
}: {
  image: string | null;
  children: ReactNode;
}) {
  const revalidator = useRevalidator();
  const input = useRef<HTMLInputElement>(null);
  const errorId = useId();
  const [draft, setDraft] = useState<string | null>();
  const [error, setError] = useState<string>();
  // One thing at a time: shrinking the chosen photo or saving it.
  const [work, setWork] = useState<"idle" | "preparing" | "saving">("idle");
  const preparing = work === "preparing";
  const pending = work === "saving";
  const preview = draft === undefined ? image : draft;
  const busy = work !== "idle";
  const changed = draft !== undefined && draft !== image;

  async function selectPhoto(file: File) {
    setWork("preparing");
    setError(undefined);
    try {
      setDraft(await preparePhoto(file));
    } catch (failure) {
      setError(photoErrorMessage(failure));
    } finally {
      setWork("idle");
    }
  }

  async function savePhoto() {
    if (draft === undefined) return;
    setWork("saving");
    setError(undefined);
    try {
      const { error: failure } = await authClient.updateUser({ image: draft });
      if (failure) return setError(authErrorMessage(failure, "Não foi possível salvar a foto."));
      toast.success(draft === null ? "Foto de perfil removida." : "Foto de perfil atualizada.");
      // The draft is not cleared: it stays as the preview until the new image arrives.
      void revalidator.revalidate();
    } catch (saveError) {
      reportBrowserError(saveError);
      setError("Não foi possível salvar a foto. Tente de novo.");
    } finally {
      setWork("idle");
    }
  }

  function pickFile() {
    input.current?.click();
  }

  const avatar = <AvatarFace image={preview} preparing={preparing} />;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col items-start gap-4 @sm:flex-row @sm:items-center @sm:gap-6">
        {preview ? (
          <PhotoMenu
            busy={busy}
            onPick={pickFile}
            onRemove={() => {
              setDraft(null);
              setError(undefined);
            }}
          >
            {avatar}
          </PhotoMenu>
        ) : (
          <button
            type="button"
            aria-label="Escolher foto de perfil (JPG, PNG ou WebP, até 5 MB)"
            disabled={busy}
            onClick={pickFile}
            className={AVATAR_BUTTON_CLASS}
          >
            {avatar}
          </button>
        )}
        <div className="min-w-0 flex-1">{children}</div>
      </div>
      <input
        ref={input}
        type="file"
        accept={PROFILE_PHOTO.mimeTypes.join(",")}
        // Outside the accessibility tree: the control is the avatar button.
        hidden
        aria-label="Escolher foto de perfil"
        disabled={busy}
        onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          event.currentTarget.value = "";
          if (file) void selectPhoto(file);
        }}
      />
      <FormError id={errorId} message={error} />
      {changed ? (
        <PendingPhotoBar
          removing={draft === null}
          busy={busy}
          pending={pending}
          onCancel={() => {
            setDraft(undefined);
            setError(undefined);
          }}
          onSave={() => void savePhoto()}
        />
      ) : null}
    </div>
  );
}

function AvatarFace({ image, preparing }: { image: string | null; preparing: boolean }) {
  return (
    <>
      <UserAvatar
        image={image}
        className="size-20 text-2xl @sm:size-24 [&_[data-slot=avatar-fallback]]:bg-brand [&_[data-slot=avatar-fallback]]:text-brand-ink"
      />
      <span className="absolute right-0 bottom-0 grid size-8 place-items-center rounded-full border-2 border-surface bg-surface-3 text-ink transition-colors group-hover:bg-brand group-hover:text-brand-ink">
        {preparing ? (
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        ) : (
          <Camera className="size-4" aria-hidden="true" />
        )}
      </span>
    </>
  );
}

/** With a photo, the avatar opens a menu to change or remove it. */
function PhotoMenu({
  busy,
  onPick,
  onRemove,
  children,
}: {
  busy: boolean;
  onPick: () => void;
  onRemove: () => void;
  children: ReactNode;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild disabled={busy}>
        <button type="button" aria-label="Alterar foto de perfil" className={AVATAR_BUTTON_CLASS}>
          {children}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-48">
        <DropdownMenuLabel className="text-xs font-normal text-ink-muted">
          JPG, PNG ou WebP. Até 5 MB.
        </DropdownMenuLabel>
        <DropdownMenuItem onSelect={onPick}>
          <ImageUp aria-hidden="true" />
          Trocar foto
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onSelect={onRemove}>
          <Trash2 aria-hidden="true" />
          Remover foto
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Confirmation bar for the unsaved preview: cancel it or save it. */
function PendingPhotoBar({
  removing,
  busy,
  pending,
  onCancel,
  onSave,
}: {
  removing: boolean;
  busy: boolean;
  pending: boolean;
  onCancel: () => void;
  onSave: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface-2 px-4 py-3">
      <p className="text-sm text-ink-muted">
        {removing ? "A foto será removida." : "Gostou da nova foto?"}
      </p>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="ghost" disabled={busy} onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="button" loading={pending} disabled={busy} onClick={onSave}>
          Salvar foto
        </Button>
      </div>
    </div>
  );
}

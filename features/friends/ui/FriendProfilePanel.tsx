import { useNavigate } from "react-router";
import { InitialsAvatar } from "@/components/InitialsAvatar";
import { friendPhotoPath, type FriendPerson } from "@/features/friends/domain/friend-lists";
import type { ShownStatus } from "@/features/friends/domain/presence-status";
import { FriendAvatar, presenceLabel } from "@/features/friends/ui/FriendAvatar";
import { FriendMenu } from "@/features/friends/ui/FriendMenu";

export interface FriendProfileView {
  id: string;
  name: string;
  code: string;
  /** Already written out, e.g. "outubro de 2026". */
  since: string;
  mutual: { shown: FriendPerson[]; total: number };
}

function mutualLabel(total: number) {
  if (total === 0) return "Nenhum amigo em comum";
  if (total === 1) return "1 amigo em comum";
  return `${total} amigos em comum`;
}

function MutualFriends({ mutual }: { mutual: FriendProfileView["mutual"] }) {
  return (
    <section aria-label="Amigos em comum" className="flex flex-col gap-2">
      <h3 className="text-xs font-semibold tracking-wide text-ink-subtle uppercase">
        Amigos em comum
      </h3>
      {mutual.total > 0 ? (
        <ul className="flex -space-x-2" aria-label={mutualLabel(mutual.total)}>
          {mutual.shown.map((person) => (
            <li key={person.id} title={person.name}>
              <InitialsAvatar
                name={person.name}
                source={friendPhotoPath(person.id)}
                className="size-8 bg-brand/15 text-xs font-medium text-brand-soft ring-2 ring-surface"
              />
            </li>
          ))}
        </ul>
      ) : null}
      <p className="text-sm text-ink-muted">{mutualLabel(mutual.total)}</p>
    </section>
  );
}

/** The friend beside the conversation: photo, name, code, mutual friends and the "…". */
export function FriendProfilePanel({
  profile,
  status,
}: {
  profile: FriendProfileView;
  status: ShownStatus;
}) {
  const navigate = useNavigate();
  const friend = { id: profile.id, name: profile.name, status };
  return (
    <div className="flex flex-col gap-6 p-5">
      <div className="flex justify-end">
        <FriendMenu
          person={friend}
          onDone={() => void navigate("/amigos", { replace: true, viewTransition: true })}
        />
      </div>
      <div className="-mt-6 flex flex-col items-center text-center">
        <FriendAvatar
          friend={friend}
          size="size-24 text-3xl"
          dot="size-5 right-1 bottom-1 ring-4"
        />
        <h2 className="mt-3 text-xl font-semibold tracking-tight">{profile.name}</h2>
        <p className="mt-0.5 font-mono text-sm tracking-wider text-ink-muted">{profile.code}</p>
        <p className="mt-1 text-xs text-ink-subtle">{presenceLabel(friend)}</p>
      </div>
      <MutualFriends mutual={profile.mutual} />
      <section className="flex flex-col gap-1">
        <h3 className="text-xs font-semibold tracking-wide text-ink-subtle uppercase">
          Amigos desde
        </h3>
        <p className="text-sm">{profile.since}</p>
      </section>
    </div>
  );
}

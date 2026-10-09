import { UserRound } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

/**
 * The same photo everywhere the account appears; without one, the default person icon.
 * A plain <img>, not Radix's AvatarImage: that one renders nothing until the browser has
 * loaded it after hydration, so the server HTML (and a slow or failed hydration) showed the
 * icon instead. The photo is a data URL checked by the server, so it cannot fail to load.
 */
export function UserAvatar({ image, className }: { image: string | null; className?: string }) {
  return (
    <Avatar className={className} aria-hidden="true">
      {image ? (
        <img
          data-slot="avatar-image"
          src={image}
          alt=""
          referrerPolicy="no-referrer"
          className="aspect-square size-full rounded-full object-cover"
        />
      ) : (
        <AvatarFallback>
          <UserRound className="size-[55%]" strokeWidth={1.75} aria-hidden="true" />
        </AvatarFallback>
      )}
    </Avatar>
  );
}

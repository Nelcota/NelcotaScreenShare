import { UserRound } from "lucide-react";
import { useState } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

/**
 * The same photo everywhere the account appears; without one, the default person icon.
 * A plain <img>, not Radix's AvatarImage: that one renders nothing until the browser has
 * loaded it after hydration, so the server HTML (and a slow or failed hydration) showed the
 * icon instead. The source is a server-validated data URL, but decoding may still fail.
 */
export function UserAvatar({ image, className }: { image: string | null; className?: string }) {
  const [failedImage, setFailedImage] = useState<string | null>(null);
  return (
    <Avatar className={className} aria-hidden="true">
      {image && image !== failedImage ? (
        <img
          key={image}
          ref={(element) => {
            // The SSR image may have failed before hydration installed onError.
            if (!element?.complete || element.naturalWidth > 0) return;
            setFailedImage(image);
          }}
          onError={() => setFailedImage(image)}
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

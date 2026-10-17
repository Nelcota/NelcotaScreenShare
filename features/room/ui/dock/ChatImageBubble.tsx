import { cn } from "@/lib/utils";

/**
 * An image sent in the call chat, as a thumbnail: a click opens it full size in a new tab,
 * where it can be saved. It lives only in this browser's memory while the call lasts.
 */
export function ChatImageBubble({
  image,
  mine,
  senderName,
}: {
  image: { url: string; name: string };
  mine: boolean;
  senderName: string;
}) {
  return (
    <a
      href={image.url}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Abrir a imagem de ${senderName}`}
      className={cn(
        "block overflow-hidden rounded-2xl border border-line bg-surface-3 outline-none focus-visible:ring-3 focus-visible:ring-brand-soft",
        mine ? "rounded-br-md" : "rounded-bl-md",
      )}
    >
      <img
        src={image.url}
        alt={image.name ? `Imagem: ${image.name}` : "Imagem enviada na chamada"}
        loading="lazy"
        className="block max-h-56 w-auto max-w-full object-contain"
      />
    </a>
  );
}

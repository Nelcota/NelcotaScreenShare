/** Unread messages on the corner of a photo: a friend's or a group's. */
export function UnreadCount({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="absolute -top-1 -right-1 z-10 grid h-4 min-w-4 place-items-center rounded-full bg-danger px-1 text-[0.625rem] font-bold text-canvas ring-2 ring-surface">
      {count > 99 ? "99+" : count}
    </span>
  );
}

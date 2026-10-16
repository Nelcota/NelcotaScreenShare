import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

/**
 * Card for the access screens (sign-in, 2FA, password, invitation), for admin and app.
 * Inside a split access layout (`data-layout="split"`), it becomes the form
 * itself: no card background and no icon (the mascot beside it already plays
 * that role).
 */
export function AuthCard({
  icon: Icon,
  title,
  description,
  top,
  children,
  footer,
}: {
  icon: LucideIcon;
  title: string;
  description?: ReactNode;
  /** Above the title (e.g. the Entrar | Criar conta tabs, room context). */
  top?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="panel w-full max-w-sm rounded-2xl p-7 group-data-[layout=split]/access:border-0 group-data-[layout=split]/access:bg-transparent group-data-[layout=split]/access:p-0! group-data-[layout=split]/access:shadow-none sm:p-8">
      {top ? <div className="mb-6 flex flex-col gap-4">{top}</div> : null}
      <span className="grid size-11 place-items-center rounded-xl bg-surface-2 group-data-[layout=split]/access:hidden">
        <Icon className="size-5 text-brand-soft" aria-hidden="true" />
      </span>
      <h1 className="mt-5 text-2xl font-semibold tracking-tight group-data-[layout=split]/access:mt-0 group-data-[layout=split]/access:text-2xl">
        {title}
      </h1>
      {description ? (
        <p className="mt-1.5 text-sm font-light text-ink-muted">{description}</p>
      ) : null}
      <div className="mt-6">{children}</div>
      {footer ? <div className="mt-6 text-center text-sm text-ink-muted">{footer}</div> : null}
    </div>
  );
}

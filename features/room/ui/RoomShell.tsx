import type { ReactNode } from "react";
import { AppHeader } from "@/components/shell/AppHeader";

/**
 * The call with the app's friends column on its left. The call's area contains its layout,
 * so the dock, the chat and the corner mascot (fixed) stay inside the space left over.
 * Minimized, both wrappers step aside (`display: contents`) without remounting the call.
 */
export function CallShell({
  column,
  minimized,
  children,
}: {
  column: ReactNode;
  minimized: boolean;
  children: ReactNode;
}) {
  const shown = column !== undefined && column !== null && !minimized;
  return (
    <div className={shown ? "flex h-dvh bg-canvas" : "contents"}>
      {shown ? <div className="flex shrink-0 py-3 pl-3 max-sm:hidden">{column}</div> : null}
      <div className={shown ? "relative min-w-0 flex-1 [contain:layout]" : "contents"}>
        {children}
      </div>
    </div>
  );
}

/**
 * Pre-join, leave and unavailable screens. Signed in, they sit in the app: its header and
 * the friends column. A guest keeps the plain header.
 */
export function ScreenShell({
  column,
  account,
  accountHref,
  children,
}: {
  column: ReactNode;
  account: { name: string; image: string | null } | null;
  accountHref?: string;
  children: ReactNode;
}) {
  if (column === undefined || column === null) {
    return (
      <div className="flex min-h-dvh flex-col">
        <AppHeader account={account} accountHref={accountHref} />
        <main className="flex flex-1 items-center-safe justify-center-safe px-4 py-6 sm:px-8 sm:py-10">
          {children}
        </main>
      </div>
    );
  }
  return (
    <div className="flex min-h-dvh flex-col bg-canvas sm:h-dvh">
      <AppHeader account={account} accountHref={accountHref} inApp wide className="shrink-0" />
      {/* Same width as the app (app/routes/app/layout.tsx), so leaving a call keeps the size. */}
      <div className="mx-auto flex min-h-0 w-full max-w-[93rem] flex-1 px-3 pt-3 sm:px-6 sm:pb-4">
        {column}
        <main className="glass flex min-w-0 flex-1 items-center-safe justify-center-safe rounded-3xl px-4 py-6 sm:overflow-y-auto sm:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}

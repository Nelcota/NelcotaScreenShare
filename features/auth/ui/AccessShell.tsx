import type { ReactNode } from "react";
import { BrandPanel } from "./BrandPanel";

/**
 * Split access panel shared by participant and admin screens: the mascot on one
 * side (a strip at the top, on mobile) and the form on the other. Inside it the
 * AuthCard does not draw its own card (`data-layout="split"`).
 */
export function AccessShell({
  header,
  scope,
  children,
}: {
  header: ReactNode;
  scope?: "user" | "admin";
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col">
      {header}
      <main className="flex flex-1 flex-col items-center px-4 pt-6 pb-8 sm:px-6 lg:justify-center lg:py-8">
        <div className="panel grid w-full max-w-4xl overflow-hidden rounded-2xl lg:min-h-[34rem] lg:grid-cols-[5fr_6fr]">
          <BrandPanel scope={scope} />
          <div
            data-layout="split"
            className="group/access flex flex-col items-center justify-center px-5 py-7 sm:px-10 sm:py-10"
          >
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}

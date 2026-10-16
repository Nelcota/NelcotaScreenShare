import { useEffect } from "react";
import { Toaster } from "@/components/ui/sonner";
import { CALL_TOASTER_ID, setCallToasterShown } from "@/features/room/client/call-notices";

/**
 * Room notices during the call: top right, right under the top bar, at most two compact
 * pills. Below popovers and dialogs (z-50), so "Sair da sala?" or a person's card is never
 * covered. Errors with "Tentar de novo" stay on the app's toaster.
 */
export function CallToaster() {
  useEffect(() => {
    setCallToasterShown(true);
    return () => setCallToasterShown(false);
  }, []);
  return (
    <Toaster
      id={CALL_TOASTER_ID}
      containerAriaLabel="Avisos da chamada"
      position="top-right"
      visibleToasts={2}
      gap={8}
      offset={{ top: "5rem", right: "1rem" }}
      mobileOffset={{ top: "4.5rem", right: "1rem", left: "1rem" }}
      style={{ zIndex: 40 }}
      toastOptions={{
        classNames: {
          toast:
            "cn-toast font-sans w-fit! max-w-96! ml-auto! rounded-3xl! px-4! py-2! min-h-0! gap-2! text-sm! shadow-soft!",
          title: "line-clamp-3 font-medium",
        },
      }}
    />
  );
}

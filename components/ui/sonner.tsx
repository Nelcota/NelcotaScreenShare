import { Toaster as Sonner, type ToasterProps } from "sonner";
import type { CSSProperties } from "react";
import { useTheme } from "@/lib/hooks/use-theme";
import {
  CircleCheckIcon,
  InfoIcon,
  TriangleAlertIcon,
  OctagonXIcon,
  Loader2Icon,
} from "lucide-react";

const toasterStyle: CSSProperties & Record<`--${string}`, string> = {
  "--normal-bg": "var(--popover)",
  "--normal-text": "var(--popover-foreground)",
  "--normal-border": "var(--border)",
  "--border-radius": "calc(var(--radius) * 1.4)",
};

const Toaster = ({ style, toastOptions, ...props }: ToasterProps) => {
  const theme = useTheme() ?? "dark";
  return (
    <Sonner
      theme={theme}
      containerAriaLabel="Avisos"
      className="toaster group"
      icons={{
        success: <CircleCheckIcon className="size-5" />,
        info: <InfoIcon className="size-5" />,
        warning: <TriangleAlertIcon className="size-5" />,
        error: <OctagonXIcon className="size-5" />,
        loading: <Loader2Icon className="size-5 animate-spin" />,
      }}
      style={{ ...toasterStyle, ...style }}
      toastOptions={{
        ...toastOptions,
        classNames: toastOptions?.classNames ?? {
          // 16 px: o padrão do Sonner (13 px) é pequeno demais para ler de relance.
          // A rounded pill sized to its text, like the call notices.
          toast:
            "cn-toast font-sans text-base! w-fit! max-w-[min(28rem,calc(100vw-2rem))]! mx-auto! left-0! right-0! rounded-3xl! px-5! py-3.5! gap-3! shadow-soft!",
          // At most two lines each: expanded toasts never grow down over the call's dock.
          title: "line-clamp-2",
          // Same look as the app's buttons, not Sonner's black and gray.
          actionButton: "rounded-full! bg-brand! px-3! text-brand-ink! font-medium!",
          cancelButton: "rounded-full! bg-ink/9! px-3! text-ink! font-medium!",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };

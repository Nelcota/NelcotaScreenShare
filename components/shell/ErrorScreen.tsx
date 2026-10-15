import { ArrowLeft, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ReactNode } from "react";

const COPY = {
  missing: {
    code: "Erro 404",
    title: "Essa página sumiu.",
    rest: "Ou nunca existiu.",
    text: "Confira o endereço. Se alguém te mandou um link de sala, peça o link de novo.",
  },
  failed: {
    code: "Algo deu errado",
    title: "Não deu para abrir.",
    rest: "Erro do nosso lado.",
    text: "Tente de novo em instantes ou volte ao início.",
  },
} as const;

/**
 * The app's last resort when a route fails: the mascot, a two-tone headline and a way
 * forward. It depends on no loader data (that may be what failed), and its links reload the
 * page so the app starts clean. The mascot comes from the app, since generic code does not
 * reach into features.
 */
export function ErrorScreen({
  missing,
  mascot,
}: {
  missing: boolean;
  /** The figure above the message (the app passes its mascot). */
  mascot: ReactNode;
}) {
  const { code, title, rest, text } = missing ? COPY.missing : COPY.failed;

  return (
    <main
      role="alert"
      className="flex min-h-dvh flex-col items-center justify-center gap-6 px-4 py-16 text-center"
    >
      {mascot}
      <p className="text-sm font-medium text-ink-subtle tabular-nums">{code}</p>
      <h1 className="text-[clamp(2.25rem,6vw,4rem)] leading-[1] font-semibold tracking-[-0.045em]">
        {title}
        <span className="block text-ink-subtle">{rest}</span>
      </h1>
      <p className="max-w-md text-lg text-pretty text-ink-muted">{text}</p>
      <div className="flex flex-wrap justify-center gap-3">
        {missing ? null : (
          <Button size="lg" onClick={() => window.location.reload()}>
            <RotateCw className="icon-spin" aria-hidden="true" />
            Tentar de novo
          </Button>
        )}
        <Button asChild size="lg" variant={missing ? "default" : "secondary"}>
          <a href="/">
            <ArrowLeft aria-hidden="true" />
            Voltar ao início
          </a>
        </Button>
      </div>
    </main>
  );
}

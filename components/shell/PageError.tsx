import { ArrowLeft, RotateCw, TriangleAlert } from "lucide-react";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";

const COPY = {
  missing: { title: "Essa página sumiu.", text: "Confira o endereço ou volte ao início." },
  failed: { title: "Não deu para abrir esta tela.", text: "Erro do nosso lado. Tente de novo." },
} as const;

/**
 * A page of the app that failed, inside the page area: the column and the header stay, so
 * the person can try again or go elsewhere without losing their place.
 */
export function PageError({ missing, onRetry }: { missing: boolean; onRetry: () => void }) {
  const { title, text } = missing ? COPY.missing : COPY.failed;
  return (
    <div
      role="alert"
      className="mx-auto flex max-w-md flex-col items-center px-6 py-16 text-center"
    >
      <span className="grid size-12 place-items-center rounded-2xl bg-danger/15">
        <TriangleAlert className="size-5 text-danger" aria-hidden="true" />
      </span>
      <h1 className="mt-5 text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-2 text-ink-muted">{text}</p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        {missing ? null : (
          <Button onClick={onRetry}>
            <RotateCw aria-hidden="true" />
            Tentar de novo
          </Button>
        )}
        <Button asChild variant={missing ? "default" : "secondary"}>
          <Link to="/inicio" viewTransition>
            <ArrowLeft aria-hidden="true" />
            Ir para o início
          </Link>
        </Button>
      </div>
    </div>
  );
}

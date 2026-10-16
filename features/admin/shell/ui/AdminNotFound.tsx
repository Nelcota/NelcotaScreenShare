import { SearchX } from "lucide-react";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";

export default function AdminNotFound() {
  return (
    <div className="panel mx-auto mt-8 w-full max-w-md rounded-2xl p-8 text-center">
      <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-surface-2">
        <SearchX className="size-5 text-brand-soft" aria-hidden="true" />
      </span>
      <h1 className="mt-5 text-2xl font-semibold tracking-tight">Não encontrado</h1>
      <p className="mt-2 text-ink-muted">Este item não existe ou foi removido.</p>
      <Button asChild className="mt-6">
        <Link viewTransition to="/admin">
          Voltar ao início
        </Link>
      </Button>
    </div>
  );
}

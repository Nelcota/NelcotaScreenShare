import { ShieldOff } from "lucide-react";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";

export const meta = () => [{ title: "Sem permissão · Nelcota" }];

export default function NoPermissionPage() {
  return (
    <div className="panel mx-auto mt-8 w-full max-w-md rounded-2xl p-8 text-center">
      <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-surface-2">
        <ShieldOff className="size-5 text-brand-soft" aria-hidden="true" />
      </span>
      <h1 className="mt-5 text-2xl font-semibold tracking-tight">Sem permissão</h1>
      <p className="mt-2 text-ink-muted">
        Seu papel não dá acesso a esta área. Se precisar, peça ao dono do painel.
      </p>
      <Button asChild className="mt-6">
        <Link viewTransition to="/admin">
          Voltar ao início
        </Link>
      </Button>
    </div>
  );
}

export { AdminErrorBoundary as ErrorBoundary } from "@/features/admin/shell/ui/AdminErrorBoundary";

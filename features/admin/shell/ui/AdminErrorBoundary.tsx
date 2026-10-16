import { useRouteError, useRevalidator, isRouteErrorResponse } from "react-router";
import AdminNotFound from "./AdminNotFound";
import { CircleAlert, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Unexpected error on an admin page: a message without internal details and a retry. */
export function AdminErrorBoundary() {
  const error = useRouteError();
  const revalidator = useRevalidator();
  if (isRouteErrorResponse(error) && error.status === 404) return <AdminNotFound />;
  return (
    <div role="alert" className="panel mx-auto mt-8 w-full max-w-md rounded-2xl p-8 text-center">
      <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-danger/15">
        <CircleAlert className="size-5 text-danger" aria-hidden="true" />
      </span>
      <h1 className="mt-5 text-2xl font-semibold tracking-tight">Algo deu errado</h1>
      <p className="mt-2 text-ink-muted">
        Não foi possível carregar esta tela. Tente de novo em instantes.
      </p>
      <Button className="mt-6" onClick={() => void revalidator.revalidate()}>
        <RotateCcw aria-hidden="true" />
        Tentar de novo
      </Button>
    </div>
  );
}

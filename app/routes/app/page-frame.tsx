import { isRouteErrorResponse, Outlet, useRevalidator, useRouteError } from "react-router";
import { PageError } from "@/components/shell/PageError";

/** The app's pages, with no data of its own: it only holds their errors inside the page area. */
export default function PageFrame() {
  return <Outlet />;
}

/** A page that failed shows its error beside the column, which keeps working. */
export function ErrorBoundary() {
  const error = useRouteError();
  const revalidator = useRevalidator();
  const missing = isRouteErrorResponse(error) && error.status === 404;
  return <PageError missing={missing} onRetry={() => void revalidator.revalidate()} />;
}

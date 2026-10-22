import type { LoaderFunctionArgs } from "react-router";
import { localDownload } from "@/server/storage/local-storage-routes.server";
import { withRequest } from "@/server/request-context.server";

/** The local storage's download link (ADR 0011); R2 serves it in production. */
export function loader({ request, context, params }: LoaderFunctionArgs) {
  return withRequest(request, context, () => localDownload(params.token));
}

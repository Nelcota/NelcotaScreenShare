import type { ActionFunctionArgs } from "react-router";
import { localUpload } from "@/server/storage/local-storage-routes.server";
import { withRequest } from "@/server/request-context.server";

/** The local storage's upload link (ADR 0011): only PUT; R2 takes it in production. */
export function action({ request, context, params }: ActionFunctionArgs) {
  return withRequest(request, context, () => localUpload(request, params.token));
}

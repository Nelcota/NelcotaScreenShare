import type { ShouldRevalidateFunctionArgs } from "react-router";
import { ROOM_FILTER_PARAM } from "@/components/workspace/room-filter";
import { ANSWERED_CALL_PARAM } from "@/features/room/domain/answered-call";

/** Address parameters only the page reads in the browser: no loader depends on them. */
const CLIENT_ONLY_PARAMS = [ROOM_FILTER_PARAM, ANSWERED_CALL_PARAM];

function withoutClientParams(url: URL): string {
  const params = new URLSearchParams(url.search);
  for (const name of CLIENT_ONLY_PARAMS) params.delete(name);
  params.sort();
  return `${url.pathname}?${params.toString()}`;
}

/** The address moved, but only in parameters the loaders never read. */
function onlyClientParamsChanged(current: URL, next: URL): boolean {
  if (current.href === next.href) return false;
  return withoutClientParams(current) === withoutClientParams(next);
}

/**
 * For the routes on screen when the room filter changes or ?atendeu leaves the address:
 * those changes reload nothing. A form, a new page or an explicit revalidation still do.
 */
export function skipClientOnlyChanges(args: ShouldRevalidateFunctionArgs): boolean {
  if (args.formMethod) return args.defaultShouldRevalidate;
  if (onlyClientParamsChanged(args.currentUrl, args.nextUrl)) return false;
  return args.defaultShouldRevalidate;
}

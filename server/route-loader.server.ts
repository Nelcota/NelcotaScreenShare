import type { LoaderFunctionArgs } from "react-router";
import { withRequest } from "./request-context.server";

type RouteRequest = LoaderFunctionArgs & { searchParams: Record<string, string> };

/** Shared scope and URL; each route still declares its own query and authorization. */
export function routeLoader<T>(load: (args: RouteRequest) => T) {
  return (args: LoaderFunctionArgs): T =>
    withRequest(args.request, args.context, () =>
      load({
        ...args,
        searchParams: Object.fromEntries(new URL(args.request.url).searchParams),
      }),
    );
}

/** The same scope for a route's `action`: forms posted without JS land here. */
export function routeAction<T>(act: (args: RouteRequest) => T) {
  return routeLoader(act);
}

/** Suffix React Router adds to a page's address when the browser asks only for its data. */
const DATA_SUFFIX = ".data";

/** Query parameter React Router adds to pick the loaders of a data request. */
const ROUTES_PARAM = "_routes";

/**
 * The page's own address, the same on the first render and on a navigation in the browser:
 * "/salas.data?filtro=x&_routes=app" becomes "/salas?filtro=x".
 */
export function pageUrl(request: Request): URL {
  const url = new URL(request.url);
  if (url.pathname.endsWith(DATA_SUFFIX)) {
    url.pathname = url.pathname.slice(0, -DATA_SUFFIX.length) || "/";
  }
  if (url.pathname === "/_root") url.pathname = "/";
  url.searchParams.delete(ROUTES_PARAM);
  return url;
}

import { useLoaderData } from "react-router";
import { routeLoader } from "@/server/route-loader.server";
import { AppEmptyState } from "./empty-state";

export const meta = () => [{ title: "Início · Nelcota" }, { name: "robots", content: "noindex" }];

export const loader = routeLoader(({ searchParams }) => ({
  invalidCode: searchParams.erro === "codigo",
}));

/** The app's start: nothing picked in the column yet. */
export default function StartPage() {
  const { invalidCode } = useLoaderData<typeof loader>();
  return <AppEmptyState title="Início" invalidCode={invalidCode} />;
}

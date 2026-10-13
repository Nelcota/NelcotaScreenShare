import { redirect } from "react-router";
import { routeLoader } from "@/server/route-loader.server";

/** Messages live in Amigos now (unread on each photo, groups on top): old links land there. */
export const loader = routeLoader(() => {
  throw redirect("/amigos");
});

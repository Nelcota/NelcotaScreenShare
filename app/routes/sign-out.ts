import { redirect } from "react-router";
import { apiAction } from "@/server/api-route.server";
import { signOutAndLeave } from "@/features/auth/server/sign-out-route.server";

export const action = apiAction(signOutAndLeave);

/** A typed /sair or a bot's GET goes home: signing out stays a POST, safe from links. */
export function loader() {
  return redirect("/");
}

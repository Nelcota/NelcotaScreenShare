import { apiAction } from "@/server/api-route.server";
import { signOutAndLeave } from "@/features/auth/server/sign-out-route.server";

export const action = apiAction(signOutAndLeave);

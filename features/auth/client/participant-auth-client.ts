import { twoFactorClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

/** Better Auth client for participant accounts (/api/auth). */
export const authClient = createAuthClient({
  basePath: "/api/auth",
  // No redirect here: the sign-in form goes to the code page inside the app, so a call going
  // on in the background survives (a full page load would end it).
  plugins: [twoFactorClient()],
});

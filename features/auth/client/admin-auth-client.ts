import { twoFactorClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

/**
 * Better Auth client for the admin panel (its own instance at
 * /api/admin/auth; never mixes with the participant account).
 */
export const adminAuthClient = createAuthClient({
  basePath: "/api/admin/auth",
  // No redirect here: the sign-in form goes to the code page inside the app, so a call going
  // on in the background survives (a full page load would end it).
  plugins: [twoFactorClient()],
});

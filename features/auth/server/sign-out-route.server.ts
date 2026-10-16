import { getUserAuth } from "@/features/auth/server/participant-auth.server";
import { forbiddenCrossSite, isCrossSiteMutation } from "@/server/origin-guard.server";

const FORWARDED_HEADERS = ["cookie", "origin", "user-agent", "x-forwarded-for"];

/**
 * "Sair" from the account menu: a plain form post, so the shared header needs no client
 * code. Ends the session through Better Auth and lands on the sign-in page.
 */
export async function signOutAndLeave(request: Request): Promise<Response> {
  if (isCrossSiteMutation(request)) return forbiddenCrossSite();
  const headers = new Headers();
  for (const name of FORWARDED_HEADERS) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  const signOut = await getUserAuth().handler(
    new Request(new URL("/api/auth/sign-out", request.url), { method: "POST", headers }),
  );
  const answer = new Headers({ Location: "/entrar?aviso=saiu" });
  for (const cookie of signOut.headers.getSetCookie()) answer.append("set-cookie", cookie);
  return new Response(null, { status: 303, headers: answer });
}

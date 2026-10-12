import { AsyncLocalStorage } from "node:async_hooks";
import { logger } from "@/server/logger.server";
import { sendMail, type MailMessage } from "@/server/mail.server";
import { sessionWithCookies } from "@/server/response-cookies.server";

const deliveryContext = new AsyncLocalStorage<{ failed: boolean }>();
const INTERACTIVE_MAIL_PATHS = new Set([
  "/api/auth/send-verification-email",
  "/api/auth/change-email",
]);

/** Public account lookups keep the same response and do not wait for delivery. */
export async function deliverAccountMail(message: MailMessage): Promise<void> {
  const context = deliveryContext.getStore();
  const delivery = sendMail(message).catch((error: unknown) => {
    logger.error({ err: error, subject: message.subject }, "failed to send account e-mail");
    if (context) context.failed = true;
  });
  if (!context) return;
  await delivery;
}

/** Better Auth swallows some callback errors; track authenticated delivery per request. */
export async function handleAuthWithMailDelivery(
  request: Request,
  auth: {
    handler: (request: Request) => Promise<Response>;
    api: {
      getSession: (options: {
        headers: Headers;
        returnHeaders: true;
      }) => Promise<{ response: unknown; headers: Headers }>;
    };
  },
): Promise<Response> {
  if (request.method !== "POST" || !INTERACTIVE_MAIL_PATHS.has(new URL(request.url).pathname)) {
    return auth.handler(request);
  }
  const session = await sessionWithCookies(
    auth.api.getSession({ headers: request.headers, returnHeaders: true }),
  );
  if (!session) return auth.handler(request);

  const context = { failed: false };
  return deliveryContext.run(context, async () => {
    const response = await auth.handler(request);
    if (!context.failed) return response;
    return Response.json(
      { code: "MAIL_DELIVERY_FAILED", message: "Não foi possível enviar o e-mail. Tente de novo." },
      { status: 503 },
    );
  });
}

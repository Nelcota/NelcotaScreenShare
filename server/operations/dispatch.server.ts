import { redirect, type ActionFunctionArgs, type LoaderFunctionArgs } from "react-router";
import type { OperationResult } from "@/lib/operations/operation";
import { BodyTooLargeError, readBodyText } from "@/server/body.server";
import { forbiddenCrossSite, isCrossSiteMutation } from "@/server/origin-guard.server";
import { withRequest } from "@/server/request-context.server";

export type OperationHandlers = Record<
  string,
  { handle: (input: unknown) => Promise<OperationResult<unknown>> }
>;

interface Dispatch {
  operations: OperationHandlers;
  /** Read-only operations: served by GET. The others, only by POST. */
  readOperations: ReadonlySet<string>;
  /** Where the operation leads on success (303 instead of the JSON). */
  successRedirects: Readonly<
    Record<string, string | ((data: unknown, input: unknown) => string | undefined)>
  >;
}

async function readInput(request: Request): Promise<unknown> {
  const payload: unknown =
    request.method === "GET"
      ? JSON.parse(new URL(request.url).searchParams.get("payload") ?? "{}")
      : JSON.parse(await readBodyText(request, 1024 * 1024));
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("invalid input");
  }
  return "input" in payload ? payload.input : undefined;
}

/** The operation's input, or the 413/400 answer for a body that cannot be read. */
async function readInputOrRejection(
  request: Request,
): Promise<{ input: unknown } | { rejection: Response }> {
  try {
    return { input: await readInput(request) };
  } catch (error) {
    if (error instanceof BodyTooLargeError) {
      return {
        rejection: Response.json(
          { serverError: "Solicitação grande demais." },
          { status: 413, headers: { "Cache-Control": "no-store" } },
        ),
      };
    }
    return {
      rejection: Response.json({ serverError: "Solicitação inválida." }, { status: 400 }),
    };
  }
}

/**
 * `loader`/`action` of `/api/operations/:operation`: checks method and origin,
 * reads the input and calls the registered operation in the request scope.
 */
export function operationDispatcher({ operations, readOperations, successRedirects }: Dispatch) {
  return async function dispatch({
    request,
    params,
    context,
  }: LoaderFunctionArgs | ActionFunctionArgs) {
    const id = params.operation ?? "";
    if (!Object.hasOwn(operations, id)) {
      return Response.json({ serverError: "Operação não encontrada." }, { status: 404 });
    }
    const expectedMethod = readOperations.has(id) ? "GET" : "POST";
    if (request.method !== expectedMethod) {
      return new Response(null, { status: 405, headers: { Allow: expectedMethod } });
    }
    if (isCrossSiteMutation(request)) return forbiddenCrossSite();
    const read = await readInputOrRejection(request);
    if ("rejection" in read) return read.rejection;
    const { input } = read;
    const operation = operations[id]!;
    const result = await withRequest(request, context, () => operation.handle(input));
    const configured = successRedirects[id];
    const destination =
      typeof configured === "function" ? configured(result.data, input) : configured;
    if (result.data !== undefined && destination) {
      return redirect(destination, { status: 303, headers: { "Cache-Control": "no-store" } });
    }
    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  };
}

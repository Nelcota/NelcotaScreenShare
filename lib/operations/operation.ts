import { z } from "zod";
import { readJson } from "@/lib/read-json";

export interface OperationResult<T> {
  data?: T;
  serverError?: string;
  validationErrors?: Record<string, unknown>;
}

export type Operation<I, O> = ((input: I) => Promise<OperationResult<O>>) & {
  url: string;
  method: "get" | "post";
  /** Whether a success changes data the open pages show (they refresh). */
  mutates: boolean;
};

const UNEXPECTED_RESPONSE = "Algo deu errado. Tente de novo.";
export const OFFLINE_MESSAGE = "Sem internet. Confira a conexão e tente de novo.";

/** The request never reached the server: offline says so, anything else is generic. */
function unreachable(): OperationResult<never> {
  const offline = typeof navigator !== "undefined" && "onLine" in navigator && !navigator.onLine;
  return { serverError: offline ? OFFLINE_MESSAGE : UNEXPECTED_RESPONSE };
}

async function send(url: string, init: RequestInit): Promise<Response | null> {
  try {
    return await fetch(url, init);
  } catch {
    return null;
  }
}

/** Checks the envelope; `data` is trusted to be the operation's declared output. */
function resultSchema<O>() {
  return z.object({
    data: z.custom<O>().optional(),
    serverError: z.string().optional(),
    validationErrors: z.record(z.string(), z.unknown()).optional(),
  });
}

/**
 * Public descriptor: only URL and types; no server code or secrets. A read that carries
 * personal data (a search term) uses POST with `mutates: false`: kept out of the URL, and
 * the open pages do not refresh after it.
 */
export function operation<I, O>(
  id: string,
  method: "get" | "post" = "post",
  { mutates = method === "post" }: { mutates?: boolean } = {},
): Operation<I, O> {
  const url = `/api/operations/${id}`;
  const execute = async (input: I): Promise<OperationResult<O>> => {
    const body = JSON.stringify({ input });
    const response = await send(
      method === "get" ? `${url}?payload=${encodeURIComponent(body)}` : url,
      {
        method: method.toUpperCase(),
        headers: method === "post" ? { "Content-Type": "application/json" } : {},
        ...(method === "post" ? { body } : {}),
      },
    );
    if (!response) return unreachable();
    const parsed = resultSchema<O>().safeParse(await readJson(response));
    // A proxy error page or an unexpected body: the same message as any server failure.
    if (!parsed.success) return { serverError: UNEXPECTED_RESPONSE };
    const result: OperationResult<O> = parsed.data;
    if (result.data !== undefined && mutates) {
      window.dispatchEvent(new Event("nelcota:mutation"));
    }
    return result;
  };
  return Object.assign(execute, { url, method, mutates });
}

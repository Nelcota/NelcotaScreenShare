import { z } from "zod";
import type { OperationResult } from "./operation";

const fieldErrorsSchema = z.object({
  fieldErrors: z.record(z.string(), z.array(z.string()).optional()),
});

/**
 * The server's first message for one field ("Use pelo menos 2 caracteres."), or undefined:
 * an operation that fails validation answers with these instead of `serverError`, and a form
 * that only shows `serverError` would show nothing.
 */
export function fieldErrorOf(
  result: Pick<OperationResult<unknown>, "validationErrors">,
  field: string,
): string | undefined {
  const parsed = fieldErrorsSchema.safeParse(result.validationErrors);
  if (!parsed.success) return undefined;
  return parsed.data.fieldErrors[field]?.[0];
}

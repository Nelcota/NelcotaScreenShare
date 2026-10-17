import type { OperationResult } from "@/lib/operations/operation";
import { fieldErrorOf } from "@/lib/operations/field-error";
import { isAddressRefusal, roomAddressSchema } from "@/features/rooms/domain/room-address";

/**
 * The last save's messages, each where it belongs: the name's and the address's under their
 * fields (a taken or reserved address comes back as the server's message), the rest on top.
 */
export function roomFormErrors(
  result: Pick<OperationResult<unknown>, "serverError" | "validationErrors">,
) {
  const refusedAddress = isAddressRefusal(result.serverError);
  return {
    error: refusedAddress ? undefined : result.serverError,
    nameError: fieldErrorOf(result, "name"),
    addressError: refusedAddress ? result.serverError : fieldErrorOf(result, "code"),
  };
}

/** The address rule on the form, before the server sees it. */
export function roomAddressProblem(code: string): string | undefined {
  const parsed = roomAddressSchema.safeParse(code);
  return parsed.success ? undefined : parsed.error.issues[0]?.message;
}

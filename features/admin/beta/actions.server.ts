import { defineAdminOperation } from "@/features/auth/server/operation-policies.server";
import { getDb } from "@/server/db/index.server";
import { provisionSchema } from "./domain/provision";
import { provisionBeta } from "./server/provision.server";
export const provisionBetaAction = defineAdminOperation(
  { name: "pro.provision", permission: { beta: ["update"] }, audit: "required" },
  provisionSchema,
  ({ parsedInput, ctx }) => provisionBeta(getDb(), parsedInput, ctx.audit),
);

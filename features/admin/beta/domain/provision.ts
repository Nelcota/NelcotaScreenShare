import { z } from "zod";
export const provisionSchema = z.object({
  subject: z.enum(["account", "team"]),
  id: z.uuid(),
  active: z.boolean(),
  roomLimit: z.number().int().min(1).max(50),
  expiresAt: z.iso.datetime().nullable(),
  reason: z.string().trim().min(3).max(300),
});
export type ProvisionInput = z.infer<typeof provisionSchema>;

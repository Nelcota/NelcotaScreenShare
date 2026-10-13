import { twoFactor } from "better-auth/plugins/two-factor";

type TwoFactorOptions = NonNullable<Parameters<typeof twoFactor>[0]>;

/**
 * The 2FA plugin with a schema of its own. In better-auth 1.7.7, `twoFactor()` merges the
 * options into one module-level schema object and returns that same object, so the admin
 * and participant instances would share a model name: whichever is created last would
 * decide the 2FA table of both. The copy is taken right after creation, before any other
 * call can change the shared object.
 */
export function isolatedTwoFactor(options: TwoFactorOptions) {
  const plugin = twoFactor(options);
  return { ...plugin, schema: structuredClone(plugin.schema) } as typeof plugin;
}

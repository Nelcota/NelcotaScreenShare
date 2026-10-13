import { currentOutput } from "@/features/room/client/saved-media";
import { logBrowserWarning } from "@/lib/telemetry.client";

/** Chrome and Edge let an audio context choose its output; others play on the default. */
function canChooseOutput(
  context: AudioContext,
): context is AudioContext & { setSinkId: (id: string) => Promise<void> } {
  return typeof Reflect.get(context, "setSinkId") === "function";
}

/** Plays an audio context on the speaker chosen for the call, where the browser allows it. */
export async function routeToChosenOutput(context: AudioContext) {
  const output = await currentOutput();
  if (!output || !canChooseOutput(context)) return;
  try {
    await context.setSinkId(output);
  } catch (error) {
    logBrowserWarning("Could not play on the chosen output", error);
  }
}

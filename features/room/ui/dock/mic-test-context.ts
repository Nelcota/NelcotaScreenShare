import { createContext, use } from "react";

/** The microphone test inside the call (MicTestProvider), read by the dock's buttons. */
export interface MicTestState {
  testing: boolean;
  busy: boolean;
  start: () => Promise<void>;
  stop: () => Promise<void>;
  /** Hands the level bar to the test, which fills it straight from the capture. */
  attachMeter: (meter: HTMLDivElement | null) => void;
}

export const MicTestContext = createContext<MicTestState | null>(null);

export function useMicTest(): MicTestState {
  const state = use(MicTestContext);
  if (state === null) throw new Error("useMicTest must be used inside MicTestProvider");
  return state;
}

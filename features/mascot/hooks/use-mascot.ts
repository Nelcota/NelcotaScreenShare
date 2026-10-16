import { useEffect, useRef, type RefObject } from "react";
import { createFaceRenderer } from "@/features/mascot/client/face-renderer";
import { createMascotController } from "@/features/mascot/client/mascot-controller";
import type { Expression } from "@/features/mascot/domain/face";
import type { MascotActivity, MascotTemperament } from "@/features/mascot/domain/personality";

type Controller = ReturnType<typeof createMascotController>;

/**
 * Connects the mascot to React. All the behavior lives in the controller
 * (client/mascot-controller.ts); here it is only mounted, unmounted and given the props.
 * Props are passed by reference: changing the activity or the resting expression does not
 * tear anything down (sleep, error, gaze), it only requests a recompute.
 */
export function useMascot(
  rootRef: RefObject<HTMLDivElement | null>,
  faceRef: RefObject<HTMLDivElement | null>,
  baseExpression: Expression,
  canSleep: boolean,
  activity: MascotActivity,
  temperament: MascotTemperament,
  welcome: number,
  voiceLevelRef?: RefObject<number>,
) {
  const props = useRef({ baseExpression, canSleep, activity, temperament, voiceLevelRef });
  const controller = useRef<Controller | undefined>(undefined);
  const lastWelcome = useRef(welcome);

  useEffect(() => {
    props.current.activity = activity;
    props.current.voiceLevelRef = voiceLevelRef;
    props.current.temperament = temperament;
    controller.current?.syncContext();
    controller.current?.update();
  }, [activity, temperament, voiceLevelRef]);

  useEffect(() => {
    props.current.baseExpression = baseExpression;
    controller.current?.update();
  }, [baseExpression]);

  useEffect(() => {
    props.current.canSleep = canSleep;
    controller.current?.resetSleep();
  }, [canSleep]);

  useEffect(() => {
    const root = rootRef.current;
    const face = faceRef.current;
    const renderer = face && createFaceRenderer(face);
    if (!root || !face || !renderer) return;
    const created = createMascotController(root, face, renderer, {
      base: () => props.current.baseExpression,
      canSleep: () => props.current.canSleep,
      activity: () => props.current.activity,
      voice: () => props.current.voiceLevelRef?.current ?? 0,
      temperament: () => props.current.temperament,
    });
    controller.current = created;
    return () => {
      controller.current = undefined;
      created.dispose();
    };
  }, [rootRef, faceRef]);

  useEffect(() => {
    if (lastWelcome.current === welcome) return;
    lastWelcome.current = welcome;
    controller.current?.welcome();
  }, [welcome]);
}

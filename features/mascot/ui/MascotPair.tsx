import { useEffect, useRef, useState } from "react";
import { Mascot } from "./Mascot";
import { createPairController } from "@/features/mascot/client/pair-controller";
import { pairActivity, type PairPhase } from "@/features/mascot/domain/pair";
import styles from "./MascotPair.module.css";

/** Both cross the bar together; a single clock keeps the meeting in sync. */
export function MascotPair({
  pending,
  compact = false,
}: {
  pending: boolean;
  /** Smaller pair for the start of the app, where the column takes part of the width. */
  compact?: boolean;
}) {
  const sceneRef = useRef<HTMLDivElement>(null);
  const [{ phase, suspended }, setPlayback] = useState<{ phase: PairPhase; suspended: boolean }>({
    phase: "rest",
    suspended: false,
  });

  const controllerRef = useRef<ReturnType<typeof createPairController> | undefined>(undefined);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    const controller = createPairController(scene, (nextPhase, nextSuspended) => {
      setPlayback({ phase: nextPhase, suspended: nextSuspended });
    });
    controllerRef.current = controller;
    return () => {
      controllerRef.current = undefined;
      controller.dispose();
    };
  }, []);

  useEffect(() => {
    controllerRef.current?.setPending(pending);
  }, [pending]);

  const activity = pairActivity(suspended ? "rest" : phase, pending);

  return (
    <div
      ref={sceneRef}
      data-mascot-pair=""
      data-phase={phase}
      data-pending={pending}
      data-compact={compact}
      className={styles.scene}
    >
      <div className={styles.visitor}>
        <div className={styles.actor}>
          <Mascot
            className={styles.mascot}
            sizes="(min-width: 640px) 384px, 336px"
            facing={phase === "return" ? "left" : "right"}
            activity={activity}
            canSleep={!pending}
          />
        </div>
      </div>
      <div className={styles.resident}>
        <div className={styles.actor}>
          <Mascot
            className={styles.mascot}
            sizes="(min-width: 640px) 384px, 336px"
            facing={phase === "return" ? "right" : "left"}
            activity={activity}
            canSleep={!pending}
          />
        </div>
      </div>
      <span aria-hidden="true" className={styles.message}>
        Toca aqui!
      </span>
      <svg aria-hidden="true" viewBox="0 0 40 40" className={styles.contact}>
        <path d="M20 5v7m-12 0 5 5m19-5-5 5M5 25l7-2m23 2-7-2" />
      </svg>
    </div>
  );
}

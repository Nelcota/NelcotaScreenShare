import { useId, useRef, useState, type CSSProperties, type RefObject } from "react";
import { Hint } from "@/components/Hint";
import { avatarFrame } from "@/features/mascot/domain/avatar-frames";
import type { Expression } from "@/features/mascot/domain/face";
import type { MascotActivity, MascotTemperament } from "@/features/mascot/domain/personality";
import { allowsPlay } from "@/features/mascot/domain/rules";
import { cn } from "@/lib/utils";
import { useMascot } from "../hooks/use-mascot";
import { MascotAccessories, type MascotAccessory } from "./MascotAccessories";
import { SpriteEyes } from "./SpriteEyes";
import styles from "./Mascot.module.css";

const atlas = "/mascot/nelcota-mint-atlas.webp";

interface MascotProps {
  className?: string;
  accessory?: MascotAccessory;
  expression?: Expression;
  canSleep?: boolean;
  sizes?: string;
  activity?: MascotActivity;
  temperament?: MascotTemperament;
  /** Monotonic room-arrival cue; updates greet once without remounting the mascot. */
  welcome?: number;
  voiceLevelRef?: RefObject<number>;
  /**
   * Which way it faces. The original art looks to the left;
   * "right" mirrors only the drawing (the gaze and the "Zzz" stay correct).
   */
  facing?: "left" | "right";
}

/** The mint-green mascot's poses preserve the approved art in every reaction. */
export function Mascot({
  className,
  accessory,
  expression = "neutral",
  canSleep = true,
  sizes = "(min-width: 640px) 624px, 528px",
  facing = "left",
  activity = "idle",
  temperament = "curious",
  welcome = 0,
  voiceLevelRef,
}: MascotProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const faceRef = useRef<HTMLDivElement>(null);
  const footClipId = useId();
  const [initialPose] = useState(() => avatarFrame(expression));
  useMascot(rootRef, faceRef, expression, canSleep, activity, temperament, welcome, voiceLevelRef);
  const faceStyle: CSSProperties & Record<`--${string}`, string | number> = {
    "--sprite-column": initialPose.column,
    "--sprite-row": initialPose.row,
    "--tilt": 0,
    "--rest": 0,
    transform:
      "translateY(calc(var(--rest) * 2%)) rotate(calc(var(--tilt) * 1deg)) scale(calc(1 + var(--rest) * 0.055), calc(1 - var(--rest) * 0.14))",
    transformOrigin: "50% 85%",
  };

  return (
    <div
      ref={rootRef}
      data-slot="mascot"
      data-expression={expression}
      data-facing={facing}
      data-temperament={temperament}
      className={cn(
        "relative shrink-0 touch-manipulation [forced-color-adjust:none] select-none",
        styles.root,
        className,
      )}
    >
      {/* Mirror outside the face: tilt and gaze (reflected in gaze.ts) stay consistent. */}
      <div
        aria-hidden="true"
        className="absolute inset-0"
        style={facing === "right" ? { transform: "scaleX(-1)" } : undefined}
      >
        <div ref={faceRef} data-slot="mascot-face" className="absolute inset-0" style={faceStyle}>
          {/* Cutouts of the art itself, behind the body: the leg joint stays hidden when the foot lifts. */}
          <svg aria-hidden="true" viewBox="0 0 512 512" className={styles.walkingFeet}>
            <defs>
              <clipPath id={`${footClipId}-left`}>
                <path d="M170 430h102v70H170z" />
              </clipPath>
              <clipPath id={`${footClipId}-right`}>
                <path d="M272 430h110v70H272z" />
              </clipPath>
            </defs>
            <g className={styles.leftFoot} data-mascot-walking-foot="left">
              <image
                href={atlas}
                width="1536"
                height="1024"
                clipPath={`url(#${footClipId}-left)`}
              />
            </g>
            <g className={styles.rightFoot} data-mascot-walking-foot="right">
              <image
                href={atlas}
                width="1536"
                height="1024"
                clipPath={`url(#${footClipId}-right)`}
              />
            </g>
          </svg>
          <div className={cn("absolute inset-0 overflow-hidden", styles.body)}>
            <div
              data-mascot-sprite=""
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "300%",
                height: "200%",
                maxWidth: "none",
                transform:
                  "translate(calc(var(--sprite-column) * -33.333333%), calc(var(--sprite-row) * -50%))",
              }}
            >
              <img
                src={atlas}
                alt=""
                sizes={sizes}
                loading="eager"
                draggable={false}
                className="absolute inset-0 size-full"
              />
              <SpriteEyes />
              <MascotAccessories accessory={accessory} />
            </div>
            <svg viewBox="0 0 512 512" className={styles.foot}>
              <path d="M184 472 Q179 486 207 486 L235 486 Q241 480 235 474" fill="#78bd90" />
            </svg>
          </div>
        </div>
      </div>
      {/* Mouse and touch play: both buttons stay out of the Tab order, so they do not
          get between the person and the page's main field. */}
      <Hint text="Fazer carinho">
        <button
          type="button"
          tabIndex={-1}
          disabled={!allowsPlay(activity)}
          data-mascot-action="pet"
          aria-label="Fazer carinho no Nelcota"
          className={styles.petTarget}
        />
      </Hint>
      <Hint text="Toca aqui!">
        <button
          type="button"
          tabIndex={-1}
          disabled={!allowsPlay(activity)}
          data-mascot-action="high-five"
          aria-label="Toca aqui com o Nelcota"
          className={styles.handTarget}
        />
      </Hint>
      <span aria-hidden="true" className={styles.invitation}>
        Toca aqui!
      </span>
      <svg aria-hidden="true" viewBox="0 0 100 100" className={styles.effects}>
        <path className={styles.heart} d="M50 20 C40 8 27 21 50 36 C73 21 60 8 50 20" />
        <g className={styles.spark}>
          <path d="M15 37v-8m-7 5-6-4m16 17-9 2" />
          <path d="m70 56 7-2m-3 9 6 5" />
        </g>
      </svg>
      <span aria-hidden="true" className={styles.dreams} data-mascot-dreams="">
        <span>Z</span>
        <span>z</span>
        <span>z</span>
      </span>
    </div>
  );
}

import { useId } from "react";
import { AVATAR_OFFSETS } from "@/features/mascot/domain/avatar-frames";

export type MascotAccessory = "headphones";

/**
 * Headphones follow every atlas pose while keeping the original mascot artwork intact. Drawn
 * over the artwork: the band crosses the top of the head, so behind it only its left end showed
 * and the headphones looked slipped.
 */
export function MascotAccessories({ accessory }: { accessory?: MascotAccessory }) {
  const id = useId();
  if (!accessory) return null;

  const shape = `${id}-shape`;
  const shell = `${id}-shell`;
  const cushion = `${id}-cushion`;

  return (
    <svg
      viewBox="0 0 1536 1024"
      aria-hidden="true"
      data-mascot-accessory={accessory}
      className="pointer-events-none absolute inset-0 size-full"
    >
      <defs>
        <linearGradient id={shell} x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#646d69" />
          <stop offset="1" stopColor="#343d39" />
        </linearGradient>
        <linearGradient id={cushion} x1="0" y1="0" x2="1" y2="0.8">
          <stop stopColor="#424b47" />
          <stop offset="1" stopColor="#252e2a" />
        </linearGradient>
        <g id={shape}>
          <path
            d="M118 252C99 183 125 119 194 105C291 83 385 117 411 214L422 280"
            fill="none"
            stroke="#303a35"
            strokeWidth="23"
            strokeLinecap="round"
          />
          <path
            d="M117 231C110 171 141 125 197 115C293 96 373 133 397 215"
            fill="none"
            stroke="#68726c"
            strokeWidth="8"
            strokeLinecap="round"
          />
          {/* The left cup mirrors the right one around its own center (123, 246). */}
          <g transform="rotate(16 123 246)">
            <rect x="109" y="193" width="43" height="108" rx="21" fill={`url(#${cushion})`} />
            <rect x="89" y="196" width="48" height="102" rx="23" fill={`url(#${shell})`} />
            <rect x="98" y="211" width="29" height="71" rx="14" fill="#95d8a9" />
            <rect x="101" y="220" width="20" height="54" rx="10" fill="#46554b" />
          </g>
          <g transform="rotate(-14 414 278)">
            <rect x="385" y="225" width="43" height="108" rx="21" fill={`url(#${cushion})`} />
            <rect x="400" y="228" width="48" height="102" rx="23" fill={`url(#${shell})`} />
            <rect x="410" y="243" width="29" height="71" rx="14" fill="#95d8a9" />
            <rect x="416" y="252" width="20" height="54" rx="10" fill="#46554b" />
          </g>
        </g>
      </defs>
      {AVATAR_OFFSETS.map(({ x, y }, index) => (
        <use key={index} href={`#${shape}`} transform={`translate(${x} ${y})`} />
      ))}
    </svg>
  );
}

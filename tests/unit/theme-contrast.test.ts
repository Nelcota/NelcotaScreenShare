import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "vitest";

const css = readFileSync(new URL("../../app/globals.css", import.meta.url), "utf8");

function themeBlock(pattern: RegExp): string {
  const block = css.match(pattern)?.[1];
  if (!block) throw new Error("Theme tokens are missing");
  return block;
}

function luminance(block: string, token: string): number {
  const hex = block.match(new RegExp(`--color-${token}:\\s*#([0-9a-f]{6});`, "i"))?.[1];
  if (!hex) throw new Error(`Missing hexadecimal theme token: ${token}`);
  const linearChannels = [0, 2, 4].map((offset) => {
    const channel = Number.parseInt(hex.slice(offset, offset + 2), 16) / 255;
    if (channel <= 0.04045) return channel / 12.92;
    return ((channel + 0.055) / 1.055) ** 2.4;
  });
  return linearChannels.reduce(
    (total, channel, index) => total + channel * [0.2126, 0.7152, 0.0722][index]!,
    0,
  );
}

const themes = [
  { name: "dark", block: themeBlock(/@theme\s*\{([\s\S]*?)\}/) },
  { name: "light", block: themeBlock(/:root\[data-theme="light"\]\s*\{([\s\S]*?)\}/) },
];

function contrastRatio(block: string, first: string, second: string): number {
  const one = luminance(block, first);
  const two = luminance(block, second);
  return (Math.max(one, two) + 0.05) / (Math.min(one, two) + 0.05);
}

const WHITE_LUMINANCE = 1;

test.each(themes)("$name theme off switch stands out from every surface", ({ name, block }) => {
  for (const background of ["canvas", "surface", "surface-2", "surface-3"]) {
    const contrast = contrastRatio(block, "switch-off", background);
    assert.ok(contrast >= 3, `${name}: switch-off on ${background} has ${contrast.toFixed(2)}:1`);
  }
  const track = luminance(block, "switch-off");
  const thumb = (WHITE_LUMINANCE + 0.05) / (track + 0.05);
  assert.ok(thumb >= 3, `${name}: white thumb on switch-off has ${thumb.toFixed(2)}:1`);
});
const SURFACES = ["canvas", "surface", "surface-2", "surface-3"] as const;
/** Text sits on these too: the filled buttons of the dock and the call card's items. */
const TEXT_BACKGROUNDS = [...SURFACES, "control"] as const;

test.each(themes)(
  "$name theme text remains readable on every surface and CTA",
  ({ name, block }) => {
    const pairs = [
      ...["ink", "ink-muted", "ink-subtle"].flatMap((text) =>
        TEXT_BACKGROUNDS.map((background) => [text, background] as const),
      ),
      ["brand-ink", "brand"] as const,
      ["brand-ink", "brand-hover"] as const,
      ["disabled-ink", "disabled"] as const,
      ...["brand", "brand-soft"].flatMap((text) =>
        SURFACES.map((background) => [text, background] as const),
      ),
    ];
    for (const [text, background] of pairs) {
      const foreground = luminance(block, text);
      const behind = luminance(block, background);
      const contrast =
        (Math.max(foreground, behind) + 0.05) / (Math.min(foreground, behind) + 0.05);
      assert.ok(
        contrast >= 4.5,
        `${name}: ${text} on ${background} has contrast ${contrast.toFixed(2)}:1`,
      );
    }
  },
);

function channels(block: string, token: string): number[] {
  const hex = block.match(new RegExp(`--color-${token}:\\s*#([0-9a-f]{6});`, "i"))?.[1];
  if (!hex) throw new Error(`Missing hexadecimal theme token: ${token}`);
  return [0, 2, 4].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16));
}

/** The block plus `--color-tint`: `token` at `alpha` over `background`, as in StatusBadge. */
function withTint(block: string, token: string, background: string, alpha: number): string {
  const behind = channels(block, background);
  const mixed = channels(block, token)
    .map((channel, index) => Math.round(channel * alpha + behind[index]! * (1 - alpha)))
    .map((channel) => channel.toString(16).padStart(2, "0"))
    .join("");
  return `${block}\n--color-tint: #${mixed};`;
}

test.each(themes)(
  "$name theme status colors read on every surface and over their tint",
  ({ name, block }) => {
    for (const status of ["danger", "success", "warning", "info", "violet"]) {
      for (const background of SURFACES) {
        const contrast = contrastRatio(block, status, background);
        assert.ok(
          contrast >= 4.5,
          `${name}: ${status} on ${background} has ${contrast.toFixed(2)}:1`,
        );
        // Badges sit on the page and on cards (canvas, surface).
        if (background !== "canvas" && background !== "surface") continue;
        const onTint = contrastRatio(withTint(block, status, background, 0.15), status, "tint");
        assert.ok(
          onTint >= 4.5,
          `${name}: ${status} on its tint over ${background} has ${onTint.toFixed(2)}:1`,
        );
      }
    }
  },
);

test.each(themes)("$name theme tiles: initials and names read on the tile", ({ name, block }) => {
  // Initials: brand-soft over the 15% brand circle on the tile.
  const initials = contrastRatio(withTint(block, "brand", "tile", 0.15), "brand-soft", "tint");
  assert.ok(initials >= 4.5, `${name}: initials on the tile have ${initials.toFixed(2)}:1`);
  for (const text of ["ink", "ink-muted"]) {
    const onTile = contrastRatio(block, text, "tile");
    assert.ok(onTile >= 4.5, `${name}: ${text} on the tile has ${onTile.toFixed(2)}:1`);
  }
});

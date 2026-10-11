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
  const channels = [0, 2, 4].map((offset) => {
    const channel = Number.parseInt(hex.slice(offset, offset + 2), 16) / 255;
    if (channel <= 0.04045) return channel / 12.92;
    return ((channel + 0.055) / 1.055) ** 2.4;
  });
  return channels.reduce(
    (total, channel, index) => total + channel * [0.2126, 0.7152, 0.0722][index]!,
    0,
  );
}

const themes = [
  { name: "dark", block: themeBlock(/@theme\s*\{([\s\S]*?)\}/) },
  { name: "light", block: themeBlock(/:root\[data-theme="light"\]\s*\{([\s\S]*?)\}/) },
];

test.each(themes)(
  "$name theme text remains readable on every surface and CTA",
  ({ name, block }) => {
    const pairs = [
      ...["ink", "ink-muted", "ink-subtle"].flatMap((text) =>
        ["canvas", "surface", "surface-2", "surface-3"].map(
          (background) => [text, background] as const,
        ),
      ),
      ["brand-ink", "brand"] as const,
      ["brand-ink", "brand-hover"] as const,
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

/** Where a section starts on screen, in pixels from the top of the viewport. */
export interface SectionTop {
  id: string;
  top: number;
}

/**
 * The section being read: the last one whose start passed the reading line. At the end of
 * the page the last section counts, even when it is too short to reach the line.
 */
export function activeSection(
  sections: readonly SectionTop[],
  line: number,
  atPageEnd: boolean,
): string | undefined {
  if (atPageEnd) return sections.at(-1)?.id;
  const passed = sections.filter((section) => section.top <= line);
  return (passed.at(-1) ?? sections[0])?.id;
}

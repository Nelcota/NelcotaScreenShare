/** Checked in order: Edge and Opera also announce Chrome, and Chrome also announces Safari. */
const BROWSERS: ReadonlyArray<readonly [RegExp, string]> = [
  [/Edg\//, "Edge"],
  [/OPR\/|Opera/, "Opera"],
  [/Firefox\//, "Firefox"],
  [/Chrome\//, "Chrome"],
  [/Safari\//, "Safari"],
];

/** Checked in order: Android also announces Linux, and iPad also announces Mac OS X. */
const SYSTEMS: ReadonlyArray<readonly [RegExp, string]> = [
  [/Windows/, "Windows"],
  [/Android/, "Android"],
  [/iPhone|iPad|iOS/, "iOS"],
  [/Mac OS X|Macintosh/, "macOS"],
  [/Linux/, "Linux"],
];

function firstMatch(
  userAgent: string,
  table: ReadonlyArray<readonly [RegExp, string]>,
  fallback: string,
): string {
  return table.find(([pattern]) => pattern.test(userAgent))?.[1] ?? fallback;
}

/** Short device description from the user agent ("Chrome no Windows"). */
export function describeUserAgent(userAgent: string | null | undefined): string {
  if (!userAgent) return "Dispositivo desconhecido";
  const browser = firstMatch(userAgent, BROWSERS, "Navegador");
  const system = firstMatch(userAgent, SYSTEMS, "sistema desconhecido");
  return `${browser} no ${system}`;
}

/** Browser family only ("Chrome"), for counts. */
export function browserName(userAgent: string | null | undefined): string {
  if (!userAgent) return "Desconhecido";
  return firstMatch(userAgent, BROWSERS, "Outro");
}

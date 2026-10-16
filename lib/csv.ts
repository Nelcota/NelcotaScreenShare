// CSV for pt-BR Excel: ";" separator, UTF-8 with BOM and protection against
// CSV injection (a cell starting with = + - @ tab or CR becomes text, with '). A cell
// with a comma is quoted too: opened with "," as separator, it stays one cell.

/** Byte order mark: makes Excel open the UTF-8 with accents intact. */
export const CSV_BOM = String.fromCharCode(0xfeff);
const SEPARATOR = ";";
const FORMULA_START = /^[=+\-@\t\r]/;

function cellText(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  switch (typeof value) {
    case "string":
      return value;
    case "number":
    case "bigint":
    case "boolean":
      return value.toString();
    default:
      return JSON.stringify(value) ?? "";
  }
}

export function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const raw = cellText(value);
  // Spreadsheets run a cell that starts like a formula: a leading quote keeps it as text.
  const text = FORMULA_START.test(raw) ? `'${raw}` : raw;
  return /[";,\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function csvRow(values: unknown[]): string {
  return `${values.map(csvCell).join(SEPARATOR)}\r\n`;
}

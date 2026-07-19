export const CSV_BOM = "﻿";

export function csvEscape(value: string | number | null | undefined): string {
  const str = value === null || value === undefined ? "" : String(value);
  if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

export function csvRow(values: (string | number | null | undefined)[]): string {
  return values.map(csvEscape).join(",");
}

export function toCsv(header: string[], rows: (string | number | null | undefined)[][]): string {
  return CSV_BOM + [csvRow(header), ...rows.map(csvRow)].join("\r\n");
}

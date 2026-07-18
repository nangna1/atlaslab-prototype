export function normalizeForSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

export function matchesQuery(value: string | null | undefined, query: string): boolean {
  if (!query) return true;
  if (!value) return false;
  return normalizeForSearch(value).includes(normalizeForSearch(query));
}

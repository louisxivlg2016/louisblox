export function normalizeSearch(value: string) {
  return value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLocaleLowerCase('fr-FR').trim();
}

export function matchesSearch(value: string, query: string) {
  return normalizeSearch(value).includes(normalizeSearch(query));
}

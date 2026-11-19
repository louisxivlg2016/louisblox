export function normalizeSearch(value: string) {
  return value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLocaleLowerCase('fr-FR').replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
}

export function matchesSearch(value: string, query: string) {
  return normalizeSearch(value).includes(normalizeSearch(query));
}

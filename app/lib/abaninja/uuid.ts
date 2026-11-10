/**
 * Format UUID bien formé (8-4-4-4-12 hexadécimal), insensible à la casse. Volontairement
 * sans contrôle de version ni de variante : on ne doit pas rejeter un identifiant réel
 * d'AbaNinja. Il n'y a ni « / », ni « . », ni « ? » possibles : l'injection de chemin reste impossible.
 */
export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

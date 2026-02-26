/**
 * Eerste letter hoofdletter, rest kleine letters (voor opslag Inzet, Soort, Status).
 */
export function capitalizeFirst(value: string): string {
  if (!value || typeof value !== 'string') return value;
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}

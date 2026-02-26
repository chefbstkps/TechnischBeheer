/**
 * Kentekennummer validatie
 * Format 1: PA-00-00 (2 letters, koppelteken, 2 cijfers, koppelteken, 2 cijfers)
 * Format 2: 00-00 AP (2 cijfers, koppelteken, 2 cijfers, spatie, 2 letters)
 * Format 3: 0000-D (4 cijfers, koppelteken, letter D) - alleen dienstplaat
 */

const FORMAT_1_REGEX = /^[A-Z]{2}-[0-9]{2}-[0-9]{2}$/i;
const FORMAT_2_REGEX = /^[0-9]{2}-[0-9]{2}\s[A-Z]{2}$/i;
const FORMAT_3_REGEX = /^[0-9]{4}-D$/i;

import type { Inzet } from '../types/database';

export type { Inzet };

export function formatLicensePlateInput(value: string): string {
  return value.trim().toUpperCase();
}

export function isValidLicensePlateFormat(
  value: string,
  inzet: Inzet | string
): boolean {
  const formatted = formatLicensePlateInput(value);
  if (!formatted) return false;

  if (inzet.toLowerCase() === 'dienstplaat') {
    return FORMAT_3_REGEX.test(formatted);
  }

  // burgerplaat: format 1 of 2
  return FORMAT_1_REGEX.test(formatted) || FORMAT_2_REGEX.test(formatted);
}

export function getLicensePlateValidationMessage(
  value: string,
  inzet: Inzet | string
): string | null {
  if (!value.trim()) return null;
  const formatted = formatLicensePlateInput(value);

  if (inzet.toLowerCase() === 'dienstplaat') {
    if (!FORMAT_3_REGEX.test(formatted)) {
      return 'Dienstplaat: format 0000-D (bijv. 1234-D)';
    }
  } else {
    if (!FORMAT_1_REGEX.test(formatted) && !FORMAT_2_REGEX.test(formatted)) {
      return 'Burgerplaat: format PA-00-00 of 00-00 AP';
    }
  }
  return null;
}

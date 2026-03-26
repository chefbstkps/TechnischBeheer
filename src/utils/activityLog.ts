export interface FieldChange {
  field: string;
  label: string;
  before: string | null;
  after: string | null;
}

export interface DiffField<T> {
  field: string;
  label: string;
  getValue: (value: T) => unknown;
}

function normalizeComparableValue(value: unknown): string {
  if (value == null || value === '') return '';
  if (typeof value === 'number') return Number.isFinite(value) ? value.toString() : '';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (Array.isArray(value)) return JSON.stringify(value);
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value).trim();
}

function formatFieldValue(value: unknown): string | null {
  if (value == null || value === '') return null;
  if (typeof value === 'boolean') return value ? 'Ja' : 'Nee';
  if (typeof value === 'number') return Number.isFinite(value) ? value.toString() : null;
  return String(value).trim() || null;
}

export function buildFieldChanges<T>(before: T, after: T, fields: DiffField<T>[]): FieldChange[] {
  return fields.reduce<FieldChange[]>((changes, field) => {
    const previousValue = field.getValue(before);
    const nextValue = field.getValue(after);
    if (normalizeComparableValue(previousValue) === normalizeComparableValue(nextValue)) {
      return changes;
    }
    changes.push({
      field: field.field,
      label: field.label,
      before: formatFieldValue(previousValue),
      after: formatFieldValue(nextValue),
    });
    return changes;
  }, []);
}

export function detectDeviceType(userAgent: string | null | undefined): string {
  if (!userAgent) return 'Onbekend';
  const ua = userAgent.toLowerCase();
  if (ua.includes('ipad') || ua.includes('tablet')) return 'Tablet';
  if (ua.includes('android') || ua.includes('iphone') || ua.includes('mobile')) return 'Mobiel';
  if (ua.includes('windows')) return 'Windows';
  if (ua.includes('mac os') || ua.includes('macintosh')) return 'macOS';
  if (ua.includes('linux')) return 'Linux';
  return 'Onbekend';
}

export function formatCurrencyValue(value: number | null | undefined): string | null {
  if (value == null) return null;
  return new Intl.NumberFormat('nl-SR', {
    style: 'currency',
    currency: 'SRD',
    currencyDisplay: 'code',
    minimumFractionDigits: 2,
  }).format(value);
}

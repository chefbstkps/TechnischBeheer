import type { AppUser } from '../types/auth';
import type { Rank } from '../types/database';

export interface RankOption {
  value: string;
  label: string;
}

function normalizeRank(value?: string | null): string {
  return value?.trim().toLowerCase() ?? '';
}

export function getRankOptions(ranks: Rank[], currentValue?: string | null): RankOption[] {
  const options = ranks.map((rank) => ({
    value: rank.rang,
    label: rank.afkorting ? `${rank.rang} (${rank.afkorting})` : rank.rang,
  }));

  const current = currentValue?.trim();
  if (!current) return options;

  const exists = ranks.some((rank) => normalizeRank(rank.rang) === normalizeRank(current));
  if (exists) return options;

  return [
    { value: current, label: `${current} (bestaande waarde)` },
    ...options,
  ];
}

export function compareUsersByRankOrder(a: AppUser, b: AppUser, ranks: Rank[]): number {
  const orderMap = new Map(ranks.map((rank) => [normalizeRank(rank.rang), rank.sort_order]));
  const aOrder = orderMap.get(normalizeRank(a.rang)) ?? Number.MAX_SAFE_INTEGER;
  const bOrder = orderMap.get(normalizeRank(b.rang)) ?? Number.MAX_SAFE_INTEGER;

  if (aOrder !== bOrder) return aOrder - bOrder;

  return `${a.first_name} ${a.last_name}`.trim().localeCompare(
    `${b.first_name} ${b.last_name}`.trim()
  );
}

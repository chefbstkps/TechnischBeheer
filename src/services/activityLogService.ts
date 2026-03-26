import { getSupabase } from '../lib/supabase';
import { authStorageKeys } from './authService';
import { detectDeviceType } from '../utils/activityLog';
import type {
  ActivityLogEntry,
  ActivityLogRecord,
  ActivityLogSubjectType,
  ActivityLogType,
  AppUserSummary,
} from '../types/database';

interface StoredUser {
  id: string;
}

interface ClientContext {
  ipAddress: string | null;
  userAgent: string | null;
  deviceType: string;
}

interface ActivityLogUserRow {
  username?: string | null;
  first_name?: string | null;
  last_name?: string | null;
}

type ActivityLogInput = Omit<
  ActivityLogRecord,
  'id' | 'created_at' | 'ip_address' | 'user_agent' | 'device_type'
>;

let clientContextPromise: Promise<ClientContext> | null = null;

function getStoredUser(): StoredUser | null {
  if (typeof localStorage === 'undefined') return null;
  const raw = localStorage.getItem(authStorageKeys.user);
  if (!raw) return null;
  try {
    const user = JSON.parse(raw) as StoredUser;
    return user?.id ? user : null;
  } catch {
    return null;
  }
}

async function getClientContext(): Promise<ClientContext> {
  if (!clientContextPromise) {
    clientContextPromise = (async () => {
      const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : null;
      let ipAddress: string | null = null;
      try {
        const response = await fetch('https://api.ipify.org?format=json');
        const payload = (await response.json()) as { ip?: string };
        ipAddress = payload.ip ?? null;
      } catch {
        ipAddress = null;
      }
      return {
        ipAddress,
        userAgent,
        deviceType: detectDeviceType(userAgent),
      };
    })();
  }
  return clientContextPromise;
}

function normalizeDetails(details: unknown): Record<string, unknown> | null {
  if (!details || typeof details !== 'object') return null;
  return JSON.parse(JSON.stringify(details)) as Record<string, unknown>;
}

function resolveActivityLogUser(
  user: ActivityLogUserRow | ActivityLogUserRow[] | null | undefined
): ActivityLogUserRow | null {
  if (!user) return null;
  return Array.isArray(user) ? user[0] ?? null : user;
}

function formatUserDisplayName(user: ActivityLogUserRow | null | undefined): string {
  if (!user) return 'Onbekend';
  const fullName = [user.first_name, user.last_name]
    .map((value) => value?.trim())
    .filter(Boolean)
    .join(' ');
  return fullName || user.username?.trim() || 'Onbekend';
}

export const ActivityLogService = {
  async log(input: ActivityLogInput): Promise<void> {
    const user = getStoredUser();
    if (!user?.id) return;

    const context = await getClientContext();
    const payload = {
      ...input,
      user_id: input.user_id ?? user.id,
      ip_address: context.ipAddress,
      user_agent: context.userAgent,
      device_type: context.deviceType,
      details: normalizeDetails(input.details),
    };

    const { error } = await getSupabase().from('activity_logs').insert(payload);
    if (error) {
      throw new Error(error.message || 'Activity log opslaan mislukt.');
    }
  },

  async list(): Promise<ActivityLogEntry[]> {
    const { data, error } = await getSupabase()
      .from('activity_logs')
      .select(
        'id,user_id,activity_type,subject_type,subject_id,subject_label,amount,ip_address,user_agent,device_type,details,created_at,app_users(username)'
      )
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(error.message || 'Activity logs laden mislukt.');
    }

    return (data ?? []).map((row) => {
      const userObj = row.app_users as { username?: string } | null;
      return {
        id: row.id as string,
        user_id: (row.user_id as string | null) ?? null,
        username: userObj?.username ?? 'Onbekend',
        activity_type: row.activity_type as ActivityLogEntry['activity_type'],
        subject_type: row.subject_type as ActivityLogEntry['subject_type'],
        subject_id: (row.subject_id as string | null) ?? null,
        subject_label: row.subject_label as string,
        amount: row.amount != null ? Number(row.amount) : null,
        ip_address: (row.ip_address as string | null) ?? null,
        user_agent: (row.user_agent as string | null) ?? null,
        device_type: (row.device_type as string | null) ?? null,
        details: (row.details as Record<string, unknown> | null) ?? null,
        created_at: row.created_at as string,
      };
    });
  },

  async getCreatedByMap(
    subjectType: ActivityLogSubjectType,
    activityType: ActivityLogType,
    subjectIds: string[]
  ): Promise<Record<string, AppUserSummary | null>> {
    const uniqueIds = Array.from(new Set(subjectIds.filter(Boolean)));
    if (uniqueIds.length === 0) return {};

    const { data, error } = await getSupabase()
      .from('activity_logs')
      .select('subject_id,user_id,app_users(username,first_name,last_name)')
      .eq('subject_type', subjectType)
      .eq('activity_type', activityType)
      .in('subject_id', uniqueIds);

    if (error) {
      throw new Error(error.message || 'Makers ophalen uit activity logs mislukt.');
    }

    const map: Record<string, AppUserSummary | null> = {};
    for (const row of data ?? []) {
      const subjectId = (row.subject_id as string | null) ?? null;
      if (!subjectId || subjectId in map) continue;

      const user = resolveActivityLogUser(
        row.app_users as ActivityLogUserRow | ActivityLogUserRow[] | null | undefined
      );
      const userId = (row.user_id as string | null) ?? null;

      map[subjectId] = userId
        ? {
            id: userId,
            username: user?.username?.trim() || 'Onbekend',
            first_name: user?.first_name ?? null,
            last_name: user?.last_name ?? null,
            display_name: formatUserDisplayName(user),
          }
        : null;
    }

    return map;
  },
};

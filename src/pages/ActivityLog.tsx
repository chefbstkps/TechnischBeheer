import { useEffect, useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import ColumnToggle, { type ColumnConfig } from '../components/ColumnToggle';
import { useAuth } from '../contexts/AuthContext';
import { ActivityLogService } from '../services/activityLogService';
import { formatCurrencyValue } from '../utils/activityLog';
import type { ActivityLogEntry, ActivityLogType } from '../types/database';
import './ActivityLog.css';

const PAGE_SIZE_STORAGE_KEY = 'activity-log-page-size';
const COLUMNS_STORAGE_KEY = 'activity-log-columns';
const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;

const DEFAULT_COLUMNS: ColumnConfig[] = [
  { key: 'timestamp', label: 'Tijdstip', visible: true },
  { key: 'user', label: 'Gebruiker', visible: true },
  { key: 'activity', label: 'Activiteit', visible: true },
  { key: 'device', label: 'Apparaat', visible: true },
  { key: 'subject', label: 'Betrekking op', visible: true },
  { key: 'amount', label: 'Bedrag', visible: true },
  { key: 'ip', label: 'IP-adres', visible: false },
  { key: 'user_agent', label: 'User agent', visible: false },
  { key: 'details', label: 'Details', visible: true },
];

const ACTIVITY_LABELS: Record<ActivityLogType, string> = {
  repair_created: 'Nieuwe reparatie',
  repair_updated: 'Reparatie bewerkt',
  repair_status_changed: 'Reparatiestatus gewijzigd',
  repair_part_added: 'Onderdeel toegevoegd',
  maintenance_created: 'Nieuwe melding',
  maintenance_plan_created: 'Aanpak toegevoegd',
  maintenance_plan_updated: 'Aanpak bewerkt',
  maintenance_status_changed: 'Aanpakstatus gewijzigd',
  vehicle_created: 'Voertuig geregistreerd',
  vehicle_updated: 'Voertuig bewerkt',
  vehicle_deleted: 'Voertuig verwijderd',
};

function getInitialPageSize(): number {
  try {
    const raw = localStorage.getItem(PAGE_SIZE_STORAGE_KEY);
    const parsed = raw ? Number(raw) : NaN;
    return PAGE_SIZE_OPTIONS.includes(parsed as (typeof PAGE_SIZE_OPTIONS)[number]) ? parsed : 10;
  } catch {
    return 10;
  }
}

function getInitialColumns(): ColumnConfig[] {
  try {
    const raw = localStorage.getItem(COLUMNS_STORAGE_KEY);
    if (!raw) return DEFAULT_COLUMNS;
    const saved = JSON.parse(raw) as { key: string; visible: boolean }[];
    const visibleByKey = Object.fromEntries(saved.map((item) => [item.key, item.visible]));
    return DEFAULT_COLUMNS.map((column) => ({
      ...column,
      visible: column.key in visibleByKey ? Boolean(visibleByKey[column.key]) : column.visible,
    }));
  } catch {
    return DEFAULT_COLUMNS;
  }
}

function formatActivityLabel(activityType: ActivityLogType): string {
  return ACTIVITY_LABELS[activityType] ?? activityType;
}

function formatDetailValue(value: unknown): string {
  if (value == null || value === '') return '-';
  if (Array.isArray(value)) return value.map((item) => formatDetailValue(item)).join(', ');
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function getDetailsSummary(log: ActivityLogEntry): string {
  const details = log.details;
  if (!details) return '-';

  const changesRaw = details.changes;
  if (Array.isArray(changesRaw) && changesRaw.length > 0) {
    return changesRaw
      .map((change) => {
        const item = change as { label?: string; before?: unknown; after?: unknown };
        return `${item.label ?? 'Wijziging'}: ${formatDetailValue(item.before)} -> ${formatDetailValue(item.after)}`;
      })
      .join(' | ');
  }

  return Object.entries(details)
    .filter(([, value]) => value != null && value !== '')
    .map(([key, value]) => `${key.replace(/_/g, ' ')}: ${formatDetailValue(value)}`)
    .join(' | ') || '-';
}

export default function ActivityLog() {
  const { isAdmin } = useAuth();
  const [logs, setLogs] = useState<ActivityLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<'all' | ActivityLogType>('all');
  const [selectedUser, setSelectedUser] = useState('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [pageSize, setPageSize] = useState(getInitialPageSize);
  const [currentPage, setCurrentPage] = useState(1);
  const [columns, setColumns] = useState<ColumnConfig[]>(getInitialColumns);

  async function loadLogs() {
    setLoading(true);
    setError('');
    try {
      const data = await ActivityLogService.list();
      setLogs(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Activity logs laden mislukt.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadLogs();
  }, []);

  useEffect(() => {
    localStorage.setItem(PAGE_SIZE_STORAGE_KEY, String(pageSize));
  }, [pageSize]);

  useEffect(() => {
    localStorage.setItem(
      COLUMNS_STORAGE_KEY,
      JSON.stringify(columns.map((column) => ({ key: column.key, visible: column.visible })))
    );
  }, [columns]);

  const activityTypes = useMemo(
    () => Array.from(new Set(logs.map((log) => log.activity_type))).sort(),
    [logs]
  );

  const users = useMemo(
    () => Array.from(new Set(logs.map((log) => log.username))).sort((a, b) => a.localeCompare(b)),
    [logs]
  );

  const filteredLogs = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return logs.filter((log) => {
      if (selectedType !== 'all' && log.activity_type !== selectedType) return false;
      if (selectedUser !== 'all' && log.username !== selectedUser) return false;

      const timestamp = new Date(log.created_at).getTime();
      if (fromDate && timestamp < new Date(`${fromDate}T00:00:00`).getTime()) return false;
      if (toDate && timestamp > new Date(`${toDate}T23:59:59`).getTime()) return false;

      if (!query) return true;

      const haystack = [
        log.username,
        formatActivityLabel(log.activity_type),
        log.subject_label,
        log.device_type ?? '',
        log.ip_address ?? '',
        getDetailsSummary(log),
      ]
        .join(' ')
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [logs, selectedType, selectedUser, fromDate, toDate, searchQuery]);

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedType, selectedUser, fromDate, toDate, searchQuery, pageSize]);

  const totalPages = Math.max(1, Math.ceil(filteredLogs.length / pageSize));

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const paginatedLogs = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredLogs.slice(start, start + pageSize);
  }, [filteredLogs, currentPage, pageSize]);

  const visibleColumns = useMemo(
    () => Object.fromEntries(columns.map((column) => [column.key, column.visible])),
    [columns]
  );

  const handleColumnToggle = (key: string, visible: boolean) => {
    setColumns((prev) => prev.map((column) => (column.key === key ? { ...column, visible } : column)));
  };

  if (!isAdmin()) {
    return (
      <div className="activity-log-page">
        <h1>Activity Log</h1>
        <p className="activity-log-error">Geen toegang.</p>
      </div>
    );
  }

  return (
    <div className="activity-log-page">
      <div className="activity-log-header">
        <div>
          <h1>Activity Log</h1>
          <p className="activity-log-subtitle">
            Overzicht van activiteiten op reparaties, werkzaamheden en voertuigen.
          </p>
        </div>
        <button type="button" className="btn-secondary" onClick={() => void loadLogs()} disabled={loading}>
          Vernieuwen
        </button>
      </div>

      {error ? <div className="activity-log-error">{error}</div> : null}

      <section className="activity-log-card activity-log-toolbar">
        <div className="activity-log-search-wrap">
          <Search size={18} className="activity-log-search-icon" aria-hidden />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Zoeken op gebruiker, activiteit, onderwerp of details"
            aria-label="Zoeken in activity log"
          />
        </div>
        <ColumnToggle columns={columns} onToggle={handleColumnToggle} />
      </section>

      <section className="activity-log-card activity-log-filters">
        <label>
          Soort activiteit
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value as 'all' | ActivityLogType)}
          >
            <option value="all">Alle activiteiten</option>
            {activityTypes.map((type) => (
              <option key={type} value={type}>
                {formatActivityLabel(type)}
              </option>
            ))}
          </select>
        </label>
        <label>
          Gebruiker
          <select value={selectedUser} onChange={(e) => setSelectedUser(e.target.value)}>
            <option value="all">Alle gebruikers</option>
            {users.map((user) => (
              <option key={user} value={user}>
                {user}
              </option>
            ))}
          </select>
        </label>
        <label>
          Van datum
          <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
        </label>
        <label>
          Tot datum
          <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
        </label>
        <label>
          Rijen per pagina
          <select
            value={String(pageSize)}
            onChange={(e) => setPageSize(Number(e.target.value))}
          >
            {PAGE_SIZE_OPTIONS.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </label>
      </section>

      <section className="activity-log-card">
        {loading ? (
          <p>Laden...</p>
        ) : (
          <>
            <div className="activity-log-table-wrap">
              <table className="activity-log-table">
                <thead>
                  <tr>
                    {visibleColumns.timestamp && <th>Tijdstip</th>}
                    {visibleColumns.user && <th>Gebruiker</th>}
                    {visibleColumns.activity && <th>Activiteit</th>}
                    {visibleColumns.device && <th>Apparaat</th>}
                    {visibleColumns.subject && <th>Betrekking op</th>}
                    {visibleColumns.amount && <th>Bedrag</th>}
                    {visibleColumns.ip && <th>IP-adres</th>}
                    {visibleColumns.user_agent && <th>User agent</th>}
                    {visibleColumns.details && <th>Details</th>}
                  </tr>
                </thead>
                <tbody>
                  {paginatedLogs.length === 0 ? (
                    <tr>
                      <td
                        colSpan={Math.max(1, columns.filter((column) => column.visible).length)}
                        className="activity-log-empty"
                      >
                        Geen activiteiten gevonden.
                      </td>
                    </tr>
                  ) : (
                    paginatedLogs.map((log) => (
                      <tr key={log.id}>
                        {visibleColumns.timestamp && (
                          <td>{new Date(log.created_at).toLocaleString('nl-NL')}</td>
                        )}
                        {visibleColumns.user && <td>{log.username}</td>}
                        {visibleColumns.activity && <td>{formatActivityLabel(log.activity_type)}</td>}
                        {visibleColumns.device && <td>{log.device_type ?? '-'}</td>}
                        {visibleColumns.subject && <td>{log.subject_label}</td>}
                        {visibleColumns.amount && <td>{formatCurrencyValue(log.amount) ?? '-'}</td>}
                        {visibleColumns.ip && <td>{log.ip_address ?? '-'}</td>}
                        {visibleColumns.user_agent && (
                          <td className="activity-log-user-agent" title={log.user_agent ?? ''}>
                            {log.user_agent ?? '-'}
                          </td>
                        )}
                        {visibleColumns.details && <td>{getDetailsSummary(log)}</td>}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="activity-log-pagination">
              <span>
                Pagina {currentPage} van {totalPages} • {filteredLogs.length} resultaat/resultaten
              </span>
              <div className="activity-log-pagination-actions">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                  disabled={currentPage === 1}
                >
                  Vorige
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                  disabled={currentPage === totalPages}
                >
                  Volgende
                </button>
              </div>
            </div>
          </>
        )}
      </section>
    </div>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import * as AuthService from '../services/authService';
import type { ActivityType, UserActivityLogEntry } from '../types/auth';
import './UsersLog.css';

const ACTIVITY_TYPES: ActivityType[] = ['login', 'logout', 'password_change', 'profile_update'];

export default function UsersLog() {
  const { isAdmin } = useAuth();
  const [logs, setLogs] = useState<UserActivityLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedType, setSelectedType] = useState<'all' | ActivityType>('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [userFilter, setUserFilter] = useState('all');

  async function loadLogs() {
    setLoading(true);
    setError('');
    try {
      const data = await AuthService.getUserActivityLogs();
      setLogs(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Logs laden mislukt.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadLogs();
  }, []);

  const usernames = useMemo(
    () => Array.from(new Set(logs.map((log) => log.username))).sort((a, b) => a.localeCompare(b)),
    [logs]
  );

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      if (selectedType !== 'all' && log.activity_type !== selectedType) return false;
      if (userFilter !== 'all' && log.username !== userFilter) return false;

      const timestamp = new Date(log.created_at).getTime();
      if (fromDate) {
        const fromTs = new Date(`${fromDate}T00:00:00`).getTime();
        if (timestamp < fromTs) return false;
      }
      if (toDate) {
        const toTs = new Date(`${toDate}T23:59:59`).getTime();
        if (timestamp > toTs) return false;
      }
      return true;
    });
  }, [logs, selectedType, userFilter, fromDate, toDate]);

  const stats = useMemo(() => {
    const total = filteredLogs.length;
    const success = filteredLogs.filter((item) => item.success).length;
    const failed = total - success;
    return { total, success, failed };
  }, [filteredLogs]);

  if (!isAdmin()) {
    return (
      <div className="users-log-page">
        <h1>Users Activity Log</h1>
        <p className="ul-error">Geen toegang.</p>
      </div>
    );
  }

  return (
    <div className="users-log-page">
      <div className="ul-header">
        <h1>Users Activity Log</h1>
        <button type="button" className="btn-secondary" onClick={() => void loadLogs()} disabled={loading}>
          Vernieuwen
        </button>
      </div>

      {error ? <div className="ul-error">{error}</div> : null}

      <section className="ul-card ul-filters">
        <label>
          Activity type
          <select value={selectedType} onChange={(e) => setSelectedType(e.target.value as 'all' | ActivityType)}>
            <option value="all">Alle</option>
            {ACTIVITY_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
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
          Gebruiker
          <select value={userFilter} onChange={(e) => setUserFilter(e.target.value)}>
            <option value="all">Alle</option>
            {usernames.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>
      </section>

      <section className="ul-card ul-stats">
        <div>Totaal: {stats.total}</div>
        <div>Success: {stats.success}</div>
        <div>Failed: {stats.failed}</div>
      </section>

      <section className="ul-card">
        {loading ? (
          <p>Laden...</p>
        ) : (
          <div className="ul-table-wrap">
            <table className="ul-table">
              <thead>
                <tr>
                  <th>Tijd</th>
                  <th>Gebruiker</th>
                  <th>Type</th>
                  <th>Resultaat</th>
                  <th>IP</th>
                  <th>User agent</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.map((log) => (
                  <tr key={log.id}>
                    <td>{new Date(log.created_at).toLocaleString('nl-NL')}</td>
                    <td>{log.username}</td>
                    <td>{log.activity_type}</td>
                    <td>{log.success ? 'Success' : 'Failed'}</td>
                    <td>{log.ip_address ?? '-'}</td>
                    <td title={log.user_agent ?? ''}>{log.user_agent ?? '-'}</td>
                    <td>{log.error_message ?? '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

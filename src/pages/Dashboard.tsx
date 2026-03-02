import { useQuery } from '@tanstack/react-query';
import { Car, CircleDollarSign, ClipboardList, Wrench } from 'lucide-react';
import { Link } from 'react-router-dom';
import { DashboardService } from '../services/dashboardService';
import { capitalizeFirst } from '../utils/string';
import './Dashboard.css';

export default function Dashboard() {
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: () => DashboardService.getStats(),
  });

  const { data: recentRepairs } = useQuery({
    queryKey: ['dashboard-recent-repairs'],
    queryFn: () => DashboardService.getRecentRepairs(5),
  });

  const { data: recentMaintenance } = useQuery({
    queryKey: ['dashboard-recent-maintenance'],
    queryFn: () => DashboardService.getRecentMaintenance(5),
  });

  const formatCurrency = (n: number) =>
    new Intl.NumberFormat('nl-SR', {
      style: 'currency',
      currency: 'SRD',
      currencyDisplay: 'code',
      minimumFractionDigits: 2,
    }).format(n);

  const formatDate = (d: string | null) =>
    d ? new Date(d).toLocaleDateString('nl-NL') : '-';

  return (
    <div className="dashboard">
      <h1 className="dashboard-title">Technisch Beheer Dashboard</h1>

      {statsLoading ? (
        <div className="dashboard-loading">Laden...</div>
      ) : (
        <div className="dashboard-stats">
          <div className="stat-card stat-card-vehicles">
            <div className="stat-card-icon">
              <Car size={22} strokeWidth={2} />
            </div>
            <span className="stat-label">Voertuigen</span>
            <span className="stat-value">{stats?.vehiclesCount ?? 0}</span>
          </div>
          <div className="stat-card stat-card-repairs">
            <div className="stat-card-icon">
              <Wrench size={22} strokeWidth={2} />
            </div>
            <span className="stat-label">Reparaties in behandeling</span>
            <span className="stat-value">{stats?.repairsInProgress ?? 0}</span>
          </div>
          <div className="stat-card stat-card-maintenance">
            <div className="stat-card-icon">
              <ClipboardList size={22} strokeWidth={2} />
            </div>
            <span className="stat-label">Werkzaamheden in behandeling</span>
            <span className="stat-value">{stats?.maintenanceInProgress ?? 0}</span>
          </div>
          <div className="stat-card stat-card-costs">
            <div className="stat-card-icon">
              <CircleDollarSign size={22} strokeWidth={2} />
            </div>
            <span className="stat-label">Totale reparatiekosten</span>
            <span className="stat-value">
              {formatCurrency(stats?.totalRepairCosts ?? 0)}
            </span>
          </div>
        </div>
      )}

      <div className="dashboard-recent">
        <div className="recent-section">
          <h2>Laatste reparaties</h2>
          <div className="recent-list">
            {recentRepairs?.length ? (
              recentRepairs.map((r: { id: string; vehicle_id: string; reden: string; status: string; kosten_totaal: number; created_at: string; vehicle?: { id: string; license_plate: string; merk: string; model: string } | { id: string; license_plate: string; merk: string; model: string }[] }) => {
                const v = Array.isArray(r.vehicle) ? r.vehicle[0] : r.vehicle;
                return (
                <Link
                  key={r.id}
                  to={`/automontage/voertuig/${r.vehicle_id}`}
                  className="recent-item"
                >
                  <span className="recent-item-main">
                    {v?.license_plate ?? '?'} – {v?.merk} {v?.model}
                  </span>
                  <span className="recent-item-meta">
                    {r.reden} • {formatCurrency(r.kosten_totaal)} • {formatDate(r.created_at)}
                  </span>
                </Link>
              );
              })
            ) : (
              <p className="recent-empty">Geen recente reparaties</p>
            )}
          </div>
        </div>
        <div className="recent-section">
          <h2>Laatste werkzaamheden</h2>
          <div className="recent-list">
            {recentMaintenance?.length ? (
              recentMaintenance.map((w: { id: string; afdeling: string; melding: string | null; status: string; datum_melding: string }) => (
                <Link
                  key={w.id}
                  to={`/werkzaamheden/melding/${w.id}`}
                  className="recent-item"
                >
                  <span className="recent-item-main">
                    {w.afdeling} – {w.melding?.slice(0, 50) ?? 'Geen melding'}
                    {w.melding && w.melding.length > 50 ? '...' : ''}
                  </span>
                  <span className="recent-item-meta">
                    {formatDate(w.datum_melding)} • {capitalizeFirst(w.status)}
                  </span>
                </Link>
              ))
            ) : (
              <p className="recent-empty">Geen recente werkzaamheden</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

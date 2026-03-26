import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Car, CircleDollarSign, ClipboardList, Wrench } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { DashboardService } from '../services/dashboardService';
import { VehicleService } from '../services/vehicleService';
import * as AuthService from '../services/authService';
import { capitalizeFirst } from '../utils/string';
import './Dashboard.css';

function getLocalDateString(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseLocalDate(value: string): Date | null {
  const [year, month, day] = value.slice(0, 10).split('-').map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

export default function Dashboard() {
  const { isAdmin } = useAuth();
  const admin = isAdmin();
  const navigate = useNavigate();

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

  const { data: vehicles = [] } = useQuery({
    queryKey: ['dashboard-vehicles'],
    queryFn: () => VehicleService.list(),
  });

  const { data: allUsers = [] } = useQuery({
    queryKey: ['dashboard-users-pending-approval'],
    queryFn: () => AuthService.getAllUsers(),
    enabled: admin,
  });

  const pendingApprovalCount = allUsers.filter((user) => !user.is_active).length;

  const formatCurrency = (n: number) =>
    new Intl.NumberFormat('nl-SR', {
      style: 'currency',
      currency: 'SRD',
      currencyDisplay: 'code',
      minimumFractionDigits: 2,
    }).format(n);

  const formatDate = (d: string | null) =>
    d ? parseLocalDate(d)?.toLocaleDateString('nl-NL') ?? '-' : '-';

  const expiredInsuranceVehicles = vehicles
    .filter((vehicle) => {
      const insuranceValidUntil = vehicle.eind_datum?.slice(0, 10);
      return Boolean(insuranceValidUntil && insuranceValidUntil < getLocalDateString());
    })
    .sort((a, b) => (a.eind_datum ?? '').localeCompare(b.eind_datum ?? ''));

  return (
    <div className="dashboard">
      <h1 className="dashboard-title">Technisch Beheer Dashboard</h1>

      {admin && pendingApprovalCount > 0 ? (
        <Link to="/user-management" className="dashboard-approval-alert">
          {pendingApprovalCount} gebruiker{pendingApprovalCount === 1 ? '' : 's'} wachten op goedkeuring!
        </Link>
      ) : null}

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
          <div className="stat-card stat-card-expired-insurance">
            <div className="stat-card-icon">
              <AlertTriangle size={22} strokeWidth={2} />
            </div>
            <span className="stat-label">Vervallen verzekeringen</span>
            <span className="stat-value">{expiredInsuranceVehicles.length}</span>
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

      {expiredInsuranceVehicles.length > 0 ? (
        <section className="dashboard-expired-insurance">
          <h2>Vervallen Verzekeringen</h2>
          <div className="dashboard-table-wrap">
            <table className="dashboard-table">
              <thead>
                <tr>
                  <th>Kenteken</th>
                  <th>Merk</th>
                  <th>Model</th>
                  <th>Verzekerd bij</th>
                  <th>Polisnummer</th>
                  <th>Verzekering geldig tot</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {expiredInsuranceVehicles.map((vehicle) => (
                  <tr
                    key={vehicle.id}
                    className="dashboard-table-row-clickable"
                    onClick={() => navigate(`/automontage/voertuig/${vehicle.id}`)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        navigate(`/automontage/voertuig/${vehicle.id}`);
                      }
                    }}
                    tabIndex={0}
                    role="link"
                  >
                    <td className="dashboard-table-link">{vehicle.license_plate}</td>
                    <td>{vehicle.merk || '-'}</td>
                    <td>{vehicle.model || '-'}</td>
                    <td>{vehicle.verzekerd || '-'}</td>
                    <td>{vehicle.polisnummer || '-'}</td>
                    <td>{formatDate(vehicle.eind_datum)}</td>
                    <td>
                      <span className="dashboard-status-invalid">Ongeldig</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </div>
  );
}

import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { CheckCircle2, Clock, CircleDollarSign, FileText } from 'lucide-react';
import { RepairService } from '../services/repairService';
import { capitalizeFirst } from '../utils/string';
import type { RepairWithParts, WerkzaamStatus } from '../types/database';
import './Repairs.css';

export default function Repairs() {
  const navigate = useNavigate();
  const { data: repairs = [], isLoading } = useQuery({
    queryKey: ['repairs-all'],
    queryFn: () => RepairService.listAll(),
  });

  const totalRepairs = repairs.length;
  const repairsAfgehandeld = repairs.filter((r) => r.status === 'afgehandeld').length;
  const repairsInBehandeling = repairs.filter((r) => r.status === 'in behandeling').length;
  const totaleKosten = repairs.reduce((sum, r) => sum + (r.kosten_totaal ?? 0), 0);

  const formatCurrency = (n: number) =>
    new Intl.NumberFormat('nl-SR', {
      style: 'currency',
      currency: 'SRD',
      currencyDisplay: 'code',
      minimumFractionDigits: 2,
    }).format(n);

  const formatDate = (d: string | null) =>
    d ? new Date(d).toLocaleDateString('nl-NL') : '-';

  const getVehicleLicensePlate = (r: RepairWithParts & { vehicle?: { id: string; license_plate: string } }) => {
    const v = Array.isArray(r.vehicle) ? r.vehicle[0] : r.vehicle;
    return v?.license_plate ?? '-';
  };

  const formatMeldingForTable = (melding: string | null) => {
    if (!melding) return '-';
    return melding.length > 50 ? `${melding.slice(0, 50)}...` : melding;
  };

  const getStatusClass = (status: WerkzaamStatus) =>
    status === 'afgehandeld' ? 'status-afgehandeld' : 'status-in-behandeling';

  return (
    <div className="repairs-page">
      <h1>Reparaties</h1>
      <p className="repairs-page-desc">
        Overzicht van alle reparaties geregistreerd via voertuigpaspoort
      </p>

      <div className="repairs-stats">
        <div className="stat-card stat-card-total">
          <div className="stat-card-icon">
            <FileText size={22} strokeWidth={2} />
          </div>
          <span className="stat-label">Totaal aantal reparaties</span>
          <span className="stat-value">{totalRepairs}</span>
        </div>
        <div className="stat-card stat-card-afgehandeld">
          <div className="stat-card-icon">
            <CheckCircle2 size={22} strokeWidth={2} />
          </div>
          <span className="stat-label">Reparaties afgehandeld</span>
          <span className="stat-value">{repairsAfgehandeld}</span>
        </div>
        <div className="stat-card stat-card-behandeling">
          <div className="stat-card-icon">
            <Clock size={22} strokeWidth={2} />
          </div>
          <span className="stat-label">Reparaties in behandeling</span>
          <span className="stat-value">{repairsInBehandeling}</span>
        </div>
        <div className="stat-card stat-card-costs">
          <div className="stat-card-icon">
            <CircleDollarSign size={22} strokeWidth={2} />
          </div>
          <span className="stat-label">Totale reparatiekosten</span>
          <span className="stat-value">{formatCurrency(totaleKosten)}</span>
        </div>
      </div>

      <div className="repairs-table-wrap">
        {isLoading ? (
          <p>Laden...</p>
        ) : (
          <table className="repairs-table">
            <thead>
              <tr>
                <th>Kenteken</th>
                <th>Reden</th>
                <th>Datum melding</th>
                <th>Melding</th>
                <th>Kosten</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {repairs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="repairs-empty-cell">
                    Geen reparaties gevonden
                  </td>
                </tr>
              ) : (
              repairs.map((r) => (
                <tr
                  key={r.id}
                  className="repairs-row-clickable"
                  onClick={() => navigate(`/automontage/voertuig/${r.vehicle_id}`)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      navigate(`/automontage/voertuig/${r.vehicle_id}`);
                    }
                  }}
                  role="button"
                  tabIndex={0}
                >
                  <td>
                    <Link
                      to={`/automontage/voertuig/${r.vehicle_id}`}
                      className="repairs-license-link"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {getVehicleLicensePlate(r)}
                    </Link>
                  </td>
                  <td>{capitalizeFirst(r.reden)}</td>
                  <td>{formatDate(r.datum_melding)}</td>
                  <td className="repairs-melding">{formatMeldingForTable(r.melding)}</td>
                  <td className="repairs-kosten">{formatCurrency(r.kosten_totaal ?? 0)}</td>
                  <td>
                    <span className={`status-badge ${getStatusClass(r.status)}`}>
                      {capitalizeFirst(r.status)}
                    </span>
                  </td>
                </tr>
              )))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

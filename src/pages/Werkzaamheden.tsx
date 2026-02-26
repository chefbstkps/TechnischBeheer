import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MaintenanceService } from '../services/maintenanceService';
import { OrganisationService } from '../services/organisationService';
import { capitalizeFirst } from '../utils/string';
import type { MaintenanceAfdeling, MaintenanceWork } from '../types/database';
import './Werkzaamheden.css';

const SOORT_OPTIONS: MaintenanceAfdeling[] = [
  'Bouw',
  'Electra',
  'Koeltechniek',
  'GaWaSa',
];

const STATUS_LABELS: Record<string, string> = {
  'in behandeling': 'In Behandeling',
  begrotingsfase: 'Begrotingsfase',
  afgehandeld: 'Afgehandeld',
};

export default function Werkzaamheden() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [selectedSoort, setSelectedSoort] = useState<MaintenanceAfdeling | ''>('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<Partial<MaintenanceWork>>({
    afdeling: 'Bouw',
    structure_id: null,
    department_id: null,
    datum_melding: new Date().toISOString().slice(0, 10),
    melding: '',
    status: 'in behandeling',
  });

  const { data: structures = [] } = useQuery({
    queryKey: ['structures'],
    queryFn: () => OrganisationService.listStructures(),
  });

  const { data: departments = [] } = useQuery({
    queryKey: ['departments', form.structure_id],
    queryFn: () =>
      OrganisationService.listDepartments(form.structure_id as string),
    enabled: !!form.structure_id,
  });

  const { data: workList = [], isLoading } = useQuery({
    queryKey: ['maintenance-work', selectedSoort || 'all'],
    queryFn: () =>
      MaintenanceService.list(
        selectedSoort ? (selectedSoort as MaintenanceAfdeling) : undefined
      ),
  });

  const workIds = workList.map((w) => w.id);
  const { data: aanpakList = [] } = useQuery({
    queryKey: ['maintenance-aanpak-by-works', [...workIds].sort().join(',')],
    queryFn: () => MaintenanceService.listAanpakByWorkIds(workIds),
    enabled: workIds.length > 0,
  });

  const kostenByWorkId = React.useMemo(() => {
    const map: Record<string, number | null> = {};
    for (const w of workList) {
      const voorWork = aanpakList
        .filter((a) => a.maintenance_work_id === w.id)
        .sort((a, b) => (b.datum || '').localeCompare(a.datum || ''));
      const afgehandeld = voorWork.find((a) => a.type === 'afgehandeld' && a.bedrag != null);
      const begroting = voorWork.find((a) => a.type === 'begroting opmaken' && a.bedrag != null);
      map[w.id] = afgehandeld?.bedrag ?? begroting?.bedrag ?? null;
    }
    return map;
  }, [workList, aanpakList]);

  const createMutation = useMutation({
    mutationFn: (w: Omit<MaintenanceWork, 'id' | 'created_at' | 'updated_at'>) =>
      MaintenanceService.create(w),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['maintenance-work'] });
      setShowForm(false);
      setForm({
        afdeling: variables.afdeling,
        structure_id: null,
        department_id: null,
        datum_melding: new Date().toISOString().slice(0, 10),
        melding: '',
        status: 'in behandeling',
      });
    },
  });

  const handleChange = (key: string, value: unknown) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (key === 'structure_id') {
      setForm((prev) => ({ ...prev, department_id: null }));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({
      afdeling: (form.afdeling as MaintenanceAfdeling) ?? 'Bouw',
      structure_id: form.structure_id || null,
      department_id: form.department_id || null,
      datum_melding: form.datum_melding!,
      melding: form.melding?.trim() || null,
      datum_aanpak: null,
      aard_werkzaamheden: null,
      status: 'in behandeling',
      datum_afgehandeld: null,
    });
  };

  const formatDate = (d: string | null) =>
    d ? new Date(d).toLocaleDateString('nl-NL') : '-';

  const formatCurrency = (n: number | null) =>
    n != null
      ? new Intl.NumberFormat('nl-SR', {
          style: 'currency',
          currency: 'SRD',
          currencyDisplay: 'code',
          minimumFractionDigits: 2,
        }).format(n)
      : '-';

  return (
    <div className="werkzaamheden">
      <h1>Werkzaamheden</h1>
      <p className="werkzaamheden-desc">
        Bouw, Electra, Koeltechniek, GaWaSa
      </p>

      <div className="werkzaamheden-controls">
        <label>
          Filter op soort
          <select
            value={selectedSoort}
            onChange={(e) =>
              setSelectedSoort(e.target.value as MaintenanceAfdeling)
            }
          >
            <option value="">Alle soorten</option>
            {SOORT_OPTIONS.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </label>
        <button onClick={() => setShowForm(true)} className="btn-primary">
          Nieuwe melding
        </button>
      </div>

      {showForm && (
        <div className="werkzaamheden-form-overlay">
          <div className="werkzaamheden-form-modal">
            <div className="werkzaamheden-form-header">
              <h2>Nieuwe melding</h2>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="form-close"
              >
                ×
              </button>
            </div>
            <form onSubmit={handleSubmit} className="werkzaamheden-form">
              <div className="form-row">
                <label>Soort werkzaamheden *</label>
                <select
                  value={String(form.afdeling ?? '')}
                  onChange={(e) =>
                    handleChange(
                      'afdeling',
                      e.target.value as MaintenanceAfdeling
                    )
                  }
                  required
                >
                  {SOORT_OPTIONS.map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-row">
                <label>Structuur</label>
                <select
                  value={String(form.structure_id ?? '')}
                  onChange={(e) =>
                    handleChange('structure_id', e.target.value || null)
                  }
                >
                  <option value="">— Selecteer —</option>
                  {structures.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-row">
                <label>Afdeling</label>
                <select
                  value={String(form.department_id ?? '')}
                  onChange={(e) =>
                    handleChange('department_id', e.target.value || null)
                  }
                  disabled={!form.structure_id}
                >
                  <option value="">— Selecteer —</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-row">
                <label>Datum melding *</label>
                <input
                  type="date"
                  value={String(form.datum_melding ?? '')}
                  onChange={(e) =>
                    handleChange('datum_melding', e.target.value)
                  }
                  required
                />
              </div>
              <div className="form-row form-row-full">
                <label>Melding</label>
                <textarea
                  value={String(form.melding ?? '')}
                  onChange={(e) => handleChange('melding', e.target.value)}
                  rows={3}
                />
              </div>
              <div className="form-actions">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="btn-secondary"
                >
                  Annuleren
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={createMutation.isPending}
                >
                  {createMutation.isPending ? 'Bezig...' : 'Opslaan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isLoading ? (
        <p>Laden...</p>
      ) : (
        <div className="werkzaamheden-table-wrap">
          <table className="werkzaamheden-table">
            <thead>
              <tr>
                <th>Soort werkzaamheden</th>
                <th>Structuur</th>
                <th>Afdeling</th>
                <th>Datum melding</th>
                <th>Melding</th>
                <th>Kosten</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {workList.map((w) => (
                <tr
                  key={w.id}
                  className="werkzaamheden-row-clickable"
                  onClick={() => navigate(`/werkzaamheden/melding/${w.id}`)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      navigate(`/werkzaamheden/melding/${w.id}`);
                    }
                  }}
                  role="button"
                  tabIndex={0}
                >
                  <td>{w.afdeling}</td>
                  <td>
                    {(w.structure as { name?: string })?.name ?? '-'}
                  </td>
                  <td>
                    {(w.department as { name?: string })?.name ?? '-'}
                  </td>
                  <td>{formatDate(w.datum_melding)}</td>
                  <td>{w.melding ?? '-'}</td>
                  <td className="werkzaamheden-kosten">{formatCurrency(kostenByWorkId[w.id])}</td>
                  <td>
                    <span
                      className={`status-badge status-${String(w.status).replace(/\s/g, '-').toLowerCase()}`}
                    >
                      {STATUS_LABELS[w.status] ?? capitalizeFirst(w.status)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

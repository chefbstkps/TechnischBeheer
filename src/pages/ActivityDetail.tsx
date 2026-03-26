import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Pencil } from 'lucide-react';
import { MaintenanceService } from '../services/maintenanceService';
import type { MaintenanceAanpakType, MaintenanceAanpak } from '../types/database';
import './ActivityDetail.css';

const STATUS_LABELS: Record<string, string> = {
  'in behandeling': 'In Behandeling',
  begrotingsfase: 'Begrotingsfase',
  afgehandeld: 'Afgehandeld',
};

function getLocalDateString(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export default function ActivityDetail() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [showAanpakForm, setShowAanpakForm] = useState(false);
  const [aanpakType, setAanpakType] = useState<MaintenanceAanpakType>('begroting opmaken');
  const [aanpakDatum, setAanpakDatum] = useState<string>(() => getLocalDateString());
  const [aanpakBeschrijving, setAanpakBeschrijving] = useState('');
  const [aanpakBedrag, setAanpakBedrag] = useState<string>('');
  const [editingAanpakId, setEditingAanpakId] = useState<string | null>(null);
  const [editAanpakForm, setEditAanpakForm] = useState<{
    type: MaintenanceAanpakType;
    datum: string;
    beschrijving: string;
    bedrag: string;
  }>({ type: 'begroting opmaken', datum: '', beschrijving: '', bedrag: '' });

  const { data: work, isLoading: workLoading } = useQuery({
    queryKey: ['maintenance-work-detail', id],
    queryFn: () => MaintenanceService.getById(id!),
    enabled: !!id,
  });

  const { data: aanpakList = [], isLoading: aanpakLoading } = useQuery({
    queryKey: ['maintenance-aanpak', id],
    queryFn: () => MaintenanceService.listAanpakByWork(id!),
    enabled: !!id,
  });

  const createAanpakMutation = useMutation({
    mutationFn: () =>
      MaintenanceService.createAanpak(
        id!,
        aanpakType,
        aanpakDatum,
        aanpakBeschrijving.trim() || null,
        aanpakBedrag === '' ? null : Number(aanpakBedrag)
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['maintenance-aanpak', id] });
      queryClient.invalidateQueries({ queryKey: ['maintenance-work-detail', id] });
      queryClient.invalidateQueries({ queryKey: ['maintenance-work'] });
      queryClient.invalidateQueries({ queryKey: ['maintenance-aanpak-by-works'] });
      setShowAanpakForm(false);
      setAanpakDatum(getLocalDateString());
      setAanpakBeschrijving('');
      setAanpakBedrag('');
    },
  });

  const updateAanpakMutation = useMutation({
    mutationFn: ({ aanpakId, data }: { aanpakId: string; data: { type: MaintenanceAanpakType; datum: string; beschrijving: string | null; bedrag: number | null } }) =>
      MaintenanceService.updateAanpak(aanpakId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['maintenance-aanpak', id] });
      queryClient.invalidateQueries({ queryKey: ['maintenance-work-detail', id] });
      queryClient.invalidateQueries({ queryKey: ['maintenance-aanpak-by-works'] });
      setEditingAanpakId(null);
    },
  });

  const startEditAanpak = (a: MaintenanceAanpak) => {
    setEditingAanpakId(a.id);
    setEditAanpakForm({
      type: a.type,
      datum: a.datum || getLocalDateString(),
      beschrijving: a.beschrijving ?? '',
      bedrag: a.bedrag != null ? String(a.bedrag) : '',
    });
  };

  const formatDate = (d: string | null) =>
    d ? new Date(d).toLocaleDateString('nl-NL') : '-';

  const formatCurrency = (n: number) =>
    new Intl.NumberFormat('nl-SR', {
      style: 'currency',
      currency: 'SRD',
      currencyDisplay: 'code',
      minimumFractionDigits: 2,
    }).format(n);

  if (!id) return <div>Geen melding geselecteerd</div>;
  if (workLoading || !work)
    return <div className="activity-detail-loading">Laden...</div>;

  const structure = work.structure as { name?: string } | undefined;
  const department = work.department as { name?: string } | undefined;

  return (
    <div className="activity-detail">
      <div className="activity-detail-header">
        <Link to="/werkzaamheden" className="activity-detail-back">
          ← Terug naar overzicht
        </Link>
        <h1>Melding: {work.afdeling} – {formatDate(work.datum_melding)}</h1>
      </div>

      <section className="activity-detail-info">
        <h2>Meldinggegevens</h2>
        <div className="activity-detail-grid">
          <div><strong>Soort werkzaamheden</strong> {work.afdeling}</div>
          <div><strong>Structuur</strong> {structure?.name ?? '-'}</div>
          <div><strong>Afdeling</strong> {department?.name ?? '-'}</div>
          <div><strong>Datum melding</strong> {formatDate(work.datum_melding)}</div>
          <div><strong>Status</strong>{' '}
            <span className={`status-badge status-${String(work.status).replace(/\s/g, '-').toLowerCase()}`}>
              {STATUS_LABELS[work.status] ?? work.status}
            </span>
          </div>
          {work.datum_afgehandeld && (
            <div><strong>Datum afgehandeld</strong> {formatDate(work.datum_afgehandeld)}</div>
          )}
          <div className="activity-detail-grid-full">
            <strong>Melding</strong>
            <p className="activity-detail-melding">{work.melding || '-'}</p>
          </div>
        </div>
      </section>

      <section className="activity-detail-aanpak">
        <div className="activity-detail-aanpak-header">
          <h2>Aanpak</h2>
          {work.status !== 'afgehandeld' && (
            <button
              onClick={() => setShowAanpakForm(true)}
              className="btn-primary"
            >
              Aanpak toevoegen
            </button>
          )}
        </div>

        {showAanpakForm && (
          <div className="aanpak-form-new">
            <div className="aanpak-form-row">
              <label htmlFor="aanpak-type">Aanpak</label>
              <select
                id="aanpak-type"
                value={aanpakType}
                onChange={(e) => setAanpakType(e.target.value as MaintenanceAanpakType)}
              >
                <option value="begroting opmaken">Begroting opmaken</option>
                <option value="afgehandeld">Afgehandeld</option>
              </select>
            </div>
            <div className="aanpak-form-row">
              <label htmlFor="aanpak-datum">Datum</label>
              <input
                id="aanpak-datum"
                type="date"
                value={aanpakDatum}
                onChange={(e) => setAanpakDatum(e.target.value)}
              />
            </div>
            <div className="aanpak-form-row">
              <label htmlFor="aanpak-bedrag">Bedrag (SRD)</label>
              <input
                id="aanpak-bedrag"
                type="number"
                min="0"
                step="0.01"
                placeholder="0,00"
                value={aanpakBedrag}
                onChange={(e) => setAanpakBedrag(e.target.value)}
              />
            </div>
            <div className="aanpak-form-row aanpak-form-row-full">
              <label htmlFor="aanpak-beschrijving">Beschrijving van werkzaamheden</label>
              <textarea
                id="aanpak-beschrijving"
                value={aanpakBeschrijving}
                onChange={(e) => setAanpakBeschrijving(e.target.value)}
                placeholder="Beschrijving van de werkzaamheden..."
                rows={3}
              />
            </div>
            <div className="aanpak-form-actions">
              <button
                onClick={() => createAanpakMutation.mutate()}
                disabled={createAanpakMutation.isPending}
                className="btn-primary"
              >
                {createAanpakMutation.isPending ? 'Bezig...' : 'Toevoegen'}
              </button>
              <button
                onClick={() => {
                  setShowAanpakForm(false);
                  setAanpakDatum(getLocalDateString());
                  setAanpakBeschrijving('');
                  setAanpakBedrag('');
                }}
                className="btn-secondary"
              >
                Annuleren
              </button>
            </div>
          </div>
        )}

        {aanpakLoading ? (
          <p>Laden...</p>
        ) : (
          <div className="aanpak-list">
            {aanpakList.length === 0 ? (
              <p className="activity-detail-empty">Nog geen aanpak toegevoegd.</p>
            ) : (
              aanpakList.map((a) => (
                <div key={a.id} className="aanpak-card">
                  <div className="aanpak-card-header">
                    <span className="aanpak-type">
                      {a.type === 'begroting opmaken' ? 'Begroting opmaken' : 'Afgehandeld'}
                    </span>
                    <span className="aanpak-datum">{formatDate(a.datum)}</span>
                    <button
                      type="button"
                      className="aanpak-btn-bewerken"
                      onClick={() => startEditAanpak(a)}
                      title="Bewerken"
                      aria-label="Bewerken"
                    >
                      <Pencil size={16} />
                    </button>
                  </div>
                  {a.bedrag != null && (
                    <p className="aanpak-bedrag-row">{formatCurrency(a.bedrag)}</p>
                  )}
                  <p className="aanpak-meta">
                    Toegevoegd door: {a.created_by?.display_name ?? '-'}
                  </p>
                  {editingAanpakId === a.id ? (
                    <div className="aanpak-form-new aanpak-edit-form">
                      <div className="aanpak-form-row">
                        <label>Aanpak</label>
                        <select
                          value={editAanpakForm.type}
                          onChange={(e) =>
                            setEditAanpakForm((f) => ({ ...f, type: e.target.value as MaintenanceAanpakType }))
                          }
                        >
                          <option value="begroting opmaken">Begroting opmaken</option>
                          <option value="afgehandeld">Afgehandeld</option>
                        </select>
                      </div>
                      <div className="aanpak-form-row">
                        <label>Datum</label>
                        <input
                          type="date"
                          value={editAanpakForm.datum}
                          onChange={(e) =>
                            setEditAanpakForm((f) => ({ ...f, datum: e.target.value }))
                          }
                        />
                      </div>
                      <div className="aanpak-form-row">
                        <label>Bedrag (SRD)</label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={editAanpakForm.bedrag}
                          onChange={(e) =>
                            setEditAanpakForm((f) => ({ ...f, bedrag: e.target.value }))
                          }
                        />
                      </div>
                      <div className="aanpak-form-row aanpak-form-row-full">
                        <label>Beschrijving van werkzaamheden</label>
                        <textarea
                          value={editAanpakForm.beschrijving}
                          onChange={(e) =>
                            setEditAanpakForm((f) => ({ ...f, beschrijving: e.target.value }))
                          }
                          rows={3}
                        />
                      </div>
                      <div className="aanpak-form-actions">
                        <button
                          type="button"
                          onClick={() =>
                            updateAanpakMutation.mutate({
                              aanpakId: a.id,
                              data: {
                                type: editAanpakForm.type,
                                datum: editAanpakForm.datum,
                                beschrijving: editAanpakForm.beschrijving.trim() || null,
                                bedrag: editAanpakForm.bedrag === '' ? null : Number(editAanpakForm.bedrag),
                              },
                            })
                          }
                          disabled={updateAanpakMutation.isPending}
                          className="btn-primary"
                        >
                          {updateAanpakMutation.isPending ? 'Opslaan...' : 'Opslaan'}
                        </button>
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={() => setEditingAanpakId(null)}
                        >
                          Annuleren
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      {a.beschrijving && (
                        <p className="aanpak-beschrijving">{a.beschrijving}</p>
                      )}
                    </>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </section>
    </div>
  );
}

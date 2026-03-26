import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { VehicleService } from '../services/vehicleService';
import { RepairService } from '../services/repairService';
import { PartsService } from '../services/partsService';
import { capitalizeFirst } from '../utils/string';
import type { ReparatieReden, RepairWithParts, RepairPart, Part } from '../types/database';
import './VehicleDetail.css';

/** Geeft de huidige datum in YYYY-MM-DD volgens de lokale tijdzone (niet UTC). */
function getLocalDateString(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Parseert YYYY-MM-DD als lokale datum zodat er geen UTC-verschuiving ontstaat. */
function parseLocalDate(value: string): Date | null {
  const [year, month, day] = value.slice(0, 10).split('-').map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

/** Formaat onderdeel voor dropdown: naam (beschrijving) als beschrijving beschikbaar is. */
function formatPartLabel(part: Part): string {
  return part.beschrijving ? `${part.name} (${part.beschrijving})` : part.name;
}

export default function VehicleDetail() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [showRepairForm, setShowRepairForm] = useState(false);
  const [newRepairReden, setNewRepairReden] = useState<ReparatieReden>('reparatie');
  const [newRepairDatum, setNewRepairDatum] = useState<string>(() => getLocalDateString());
  const [newRepairBeschrijving, setNewRepairBeschrijving] = useState('');
  const [showPartForm, setShowPartForm] = useState<string | null>(null);
  const [partForm, setPartForm] = useState({
    selectedPartId: '',
    aantal: 1,
    eenheid: 'stuk',
    prijs_per_stuk: 0,
  });
  const [editingRepairId, setEditingRepairId] = useState<string | null>(null);
  const [editRepairForm, setEditRepairForm] = useState({
    datum: '',
    reden: 'reparatie' as ReparatieReden,
    melding: '',
  });

  const { data: vehicle, isLoading: vehicleLoading } = useQuery({
    queryKey: ['vehicle', id],
    queryFn: () => VehicleService.getById(id!),
    enabled: !!id,
  });

  const { data: repairs = [], isLoading: repairsLoading } = useQuery({
    queryKey: ['repairs', id],
    queryFn: () => RepairService.listByVehicle(id!),
    enabled: !!id,
  });

  const { data: parts = [] } = useQuery({
    queryKey: ['parts'],
    queryFn: () => PartsService.list(),
  });

  const createRepairMutation = useMutation({
    mutationFn: () =>
      RepairService.create(id!, newRepairReden, {
        datum_melding: newRepairDatum || null,
        melding: newRepairBeschrijving.trim() || null,
      }, {
        source: 'VehicleDetail',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['repairs', id] });
      queryClient.invalidateQueries({ queryKey: ['repair-totals'] });
      setShowRepairForm(false);
      setNewRepairDatum(getLocalDateString());
      setNewRepairBeschrijving('');
    },
  });

  const addPartMutation = useMutation({
    mutationFn: ({ repairId, part }: { repairId: string; part: Omit<RepairPart, 'id' | 'repair_id' | 'created_at'> }) =>
      RepairService.addPart(repairId, part),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['repairs', id] });
      queryClient.invalidateQueries({ queryKey: ['repair-totals'] });
      setShowPartForm(null);
      setPartForm({ selectedPartId: '', aantal: 1, eenheid: 'stuk', prijs_per_stuk: 0 });
    },
  });

  const markAfgehandeldMutation = useMutation({
    mutationFn: (repairId: string) =>
      RepairService.update(repairId, {
        status: 'afgehandeld',
        datum_afgehandeld: getLocalDateString(),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['repairs', id] });
      queryClient.invalidateQueries({ queryKey: ['repair-totals'] });
    },
  });

  const updateRepairMutation = useMutation({
    mutationFn: ({ repairId, data }: { repairId: string; data: { datum_melding: string | null; reden: ReparatieReden; melding: string | null } }) =>
      RepairService.update(repairId, {
        datum_melding: data.datum_melding || null,
        reden: data.reden,
        melding: (data.melding ?? '').trim() || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['repairs', id] });
      queryClient.invalidateQueries({ queryKey: ['repair-totals'] });
      setEditingRepairId(null);
    },
  });

  const startEditRepair = (repair: RepairWithParts) => {
    setEditingRepairId(repair.id);
    setEditRepairForm({
      datum: repair.datum_melding ?? getLocalDateString(),
      reden: repair.reden,
      melding: repair.melding ?? '',
    });
  };

  const handleAddPart = (repairId: string) => {
    if (!partForm.selectedPartId) return;
    const part = parts.find((p) => p.id === partForm.selectedPartId);
    if (!part) return;
    const omschrijving = formatPartLabel(part);
    addPartMutation.mutate({
      repairId,
      part: {
        omschrijving,
        aantal: partForm.aantal,
        eenheid: partForm.eenheid,
        prijs_per_stuk: partForm.prijs_per_stuk,
      },
    });
  };

  const totalCost = repairs.reduce((sum, r) => sum + (r.kosten_totaal ?? 0), 0);
  const formatCurrency = (n: number) =>
    new Intl.NumberFormat('nl-SR', {
      style: 'currency',
      currency: 'SRD',
      currencyDisplay: 'code',
      minimumFractionDigits: 2,
    }).format(n);
  const formatDate = (d: string | null) =>
    d ? parseLocalDate(d)?.toLocaleDateString('nl-NL') ?? '-' : '-';

  if (!id) return <div>Geen voertuig geselecteerd</div>;
  if (vehicleLoading || !vehicle)
    return <div className="vehicle-detail-loading">Laden...</div>;

  const structure = vehicle.structure as { name?: string } | undefined;
  const department = vehicle.department as { name?: string } | undefined;
  const insuranceValidUntil = vehicle.eind_datum?.slice(0, 10) ?? null;
  const insuranceStatus = insuranceValidUntil
    ? insuranceValidUntil >= getLocalDateString()
      ? 'Geldig'
      : 'Ongeldig'
    : null;

  return (
    <div className="vehicle-detail">
      <div className="vehicle-detail-header">
        <Link to="/automontage" className="vehicle-detail-back">
          ← Terug naar overzicht
        </Link>
        <h1>Voertuigenpaspoort: {vehicle.license_plate}</h1>
      </div>

      <section className="vehicle-detail-info">
        <h2>Voertuiggegevens</h2>
        <div className="vehicle-detail-grid">
          <div><strong>Kenteken</strong> {vehicle.license_plate}</div>
          <div><strong>Inzet</strong> {capitalizeFirst(vehicle.inzet)}</div>
          <div><strong>Structuur</strong> {structure?.name ?? '-'}</div>
          <div><strong>Afdeling</strong> {department?.name ?? '-'}</div>
          <div><strong>Merk</strong> {vehicle.merk || '-'}</div>
          <div><strong>Model</strong> {vehicle.model || '-'}</div>
          <div><strong>Bouwjaar</strong> {vehicle.bouwjaar ?? '-'}</div>
          <div><strong>Soort</strong> {vehicle.soort ? capitalizeFirst(vehicle.soort) : '-'}</div>
          <div><strong>Transmissie</strong> {vehicle.transmissie ? capitalizeFirst(vehicle.transmissie) : '-'}</div>
          <div><strong>Aandrijving</strong> {vehicle.aandrijving ?? '-'}</div>
          <div><strong>Chassisnummer</strong> {vehicle.chassisnummer || '-'}</div>
          <div><strong>Status</strong> <span className={`status-badge status-${String(vehicle.status).toLowerCase()}`}>{capitalizeFirst(vehicle.status)}</span></div>
          <div><strong>Verzekerd bij</strong> {vehicle.verzekerd ? capitalizeFirst(vehicle.verzekerd) : '-'}</div>
          <div><strong>Polisnummer</strong> {vehicle.polisnummer || '-'}</div>
          <div><strong>Verzekertype</strong> {vehicle.verzekertype ? capitalizeFirst(vehicle.verzekertype) : '-'}</div>
          <div><strong>Verzekering geldig van</strong> {vehicle.start_datum ? formatDate(vehicle.start_datum) : '-'}</div>
          <div><strong>Verzekering geldig tot</strong> {vehicle.eind_datum ? formatDate(vehicle.eind_datum) : '-'}</div>
          <div>
            <strong>Verzekeringsstatus</strong>{' '}
            {insuranceStatus ? (
              <span className={`insurance-status insurance-status-${insuranceStatus.toLowerCase()}`}>
                {insuranceStatus}
              </span>
            ) : (
              '-'
            )}
          </div>
          <div className="vehicle-detail-grid-full"><strong>Opmerking</strong> {vehicle.opmerking || '-'}</div>
          <div className="vehicle-detail-grid-full"><strong>Toegevoegd door</strong> {vehicle.created_by?.display_name ?? '-'}</div>
        </div>
      </section>

      <section className="vehicle-detail-costs">
        <h2>Totale kosten sinds registratie</h2>
        <div className="vehicle-detail-total">
          {formatCurrency(totalCost)}
        </div>
      </section>

      <section className="vehicle-detail-repairs">
        <div className="vehicle-detail-repairs-header">
          <h2>Reparaties</h2>
          <button
            onClick={() => setShowRepairForm(true)}
            className="btn-primary"
          >
            Nieuwe reparatie
          </button>
        </div>

        {showRepairForm && (
          <div className="repair-form-new">
            <div className="repair-form-row">
              <label htmlFor="repair-datum">Datum</label>
              <input
                id="repair-datum"
                type="date"
                value={newRepairDatum}
                onChange={(e) => setNewRepairDatum(e.target.value)}
              />
            </div>
            <div className="repair-form-row">
              <label htmlFor="repair-werkzaamheden">Werkzaamheden</label>
              <select
                id="repair-werkzaamheden"
                value={newRepairReden}
                onChange={(e) => setNewRepairReden(e.target.value as ReparatieReden)}
              >
                <option value="reparatie">Reparatie</option>
                <option value="service">Service</option>
                <option value="diagnose">Diagnose</option>
              </select>
            </div>
            <div className="repair-form-row repair-form-row-full">
              <label htmlFor="repair-beschrijving">Beschrijving van werkzaamheden</label>
              <textarea
                id="repair-beschrijving"
                value={newRepairBeschrijving}
                onChange={(e) => setNewRepairBeschrijving(e.target.value)}
                placeholder="Beschrijving van de werkzaamheden..."
                rows={3}
              />
            </div>
            <div className="repair-form-actions">
              <button
                onClick={() => createRepairMutation.mutate()}
                disabled={createRepairMutation.isPending}
                className="btn-primary"
              >
                {createRepairMutation.isPending ? 'Bezig...' : 'Toevoegen'}
              </button>
              <button
                onClick={() => {
                  setShowRepairForm(false);
                  setNewRepairDatum(getLocalDateString());
                  setNewRepairBeschrijving('');
                }}
                className="btn-secondary"
              >
                Annuleren
              </button>
            </div>
          </div>
        )}

        {repairsLoading ? (
          <p>Laden...</p>
        ) : (
          <div className="repairs-list">
            {repairs.map((repair: RepairWithParts) => (
              <div key={repair.id} className="repair-card">
                <div className="repair-card-header">
                  <span className="repair-reden">{capitalizeFirst(repair.reden)}</span>
                  <span className={`status-badge status-${repair.status === 'afgehandeld' ? 'goed' : 'redelijk'}`}>
                    {capitalizeFirst(repair.status)}
                  </span>
                  {repair.status !== 'afgehandeld' && (
                    <button
                      type="button"
                      className="repair-btn-afgehandeld"
                      onClick={() => markAfgehandeldMutation.mutate(repair.id)}
                      disabled={markAfgehandeldMutation.isPending}
                    >
                      {markAfgehandeldMutation.isPending ? 'Bezig...' : 'Afgehandeld'}
                    </button>
                  )}
                  <button
                    type="button"
                    className="repair-btn-bewerken"
                    onClick={() => startEditRepair(repair)}
                    title="Bewerken"
                  >
                    Bewerken
                  </button>
                  <span className="repair-cost">{formatCurrency(repair.kosten_totaal ?? 0)}</span>
                </div>
                {editingRepairId === repair.id && (
                  <div className="repair-form-new repair-edit-form">
                    <div className="repair-form-row">
                      <label htmlFor={`edit-repair-datum-${repair.id}`}>Datum</label>
                      <input
                        id={`edit-repair-datum-${repair.id}`}
                        type="date"
                        value={editRepairForm.datum}
                        onChange={(e) =>
                          setEditRepairForm((f) => ({ ...f, datum: e.target.value }))
                        }
                      />
                    </div>
                    <div className="repair-form-row">
                      <label htmlFor={`edit-repair-werkzaamheden-${repair.id}`}>Werkzaamheden</label>
                      <select
                        id={`edit-repair-werkzaamheden-${repair.id}`}
                        value={editRepairForm.reden}
                        onChange={(e) =>
                          setEditRepairForm((f) => ({
                            ...f,
                            reden: e.target.value as ReparatieReden,
                          }))
                        }
                      >
                        <option value="reparatie">Reparatie</option>
                        <option value="service">Service</option>
                        <option value="diagnose">Diagnose</option>
                      </select>
                    </div>
                    <div className="repair-form-row repair-form-row-full">
                      <label htmlFor={`edit-repair-beschrijving-${repair.id}`}>
                        Beschrijving van werkzaamheden
                      </label>
                      <textarea
                        id={`edit-repair-beschrijving-${repair.id}`}
                        value={editRepairForm.melding}
                        onChange={(e) =>
                          setEditRepairForm((f) => ({ ...f, melding: e.target.value }))
                        }
                        placeholder="Beschrijving van de werkzaamheden..."
                        rows={3}
                      />
                    </div>
                    <div className="repair-form-actions">
                      <button
                        type="button"
                        onClick={() =>
                          updateRepairMutation.mutate({
                            repairId: repair.id,
                            data: {
                              datum_melding: editRepairForm.datum || null,
                              reden: editRepairForm.reden,
                              melding: editRepairForm.melding || null,
                            },
                          })
                        }
                        disabled={updateRepairMutation.isPending}
                        className="btn-primary"
                      >
                        {updateRepairMutation.isPending ? 'Opslaan...' : 'Opslaan'}
                      </button>
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() => setEditingRepairId(null)}
                      >
                        Annuleren
                      </button>
                    </div>
                  </div>
                )}
                <div className="repair-card-meta">
                  <span>Melding: {repair.datum_melding ? formatDate(repair.datum_melding) : '-'}</span>
                  <span className="meta-separator"> • </span>
                  <span>Aanpak: {repair.datum_aanpak ? formatDate(repair.datum_aanpak) : '-'}</span>
                  <span className="meta-separator"> • </span>
                  <span>Afgehandeld: {repair.datum_afgehandeld ? formatDate(repair.datum_afgehandeld) : '-'}</span>
                  <span className="meta-separator"> • </span>
                  <span>Toegevoegd door: {repair.created_by?.display_name ?? '-'}</span>
                </div>
                {repair.melding && (
                  <p className="repair-melding">{repair.melding}</p>
                )}

                <div className="repair-parts">
                  <div className="repair-parts-header">
                    <strong>Onderdelen</strong>
                    <button
                      onClick={() =>
                        setShowPartForm(showPartForm === repair.id ? null : repair.id)
                      }
                      className="btn-small"
                    >
                      {showPartForm === repair.id ? 'Sluiten' : 'Onderdeel toevoegen'}
                    </button>
                  </div>

                  {showPartForm === repair.id && (
                    <div className="part-form-inline">
                      <select
                        value={partForm.selectedPartId}
                        onChange={(e) =>
                          setPartForm((p) => ({ ...p, selectedPartId: e.target.value }))
                        }
                        aria-label="Onderdeel"
                      >
                        <option value="">— Selecteer onderdeel —</option>
                        {parts.map((p) => (
                          <option key={p.id} value={p.id}>
                            {formatPartLabel(p)}
                          </option>
                        ))}
                      </select>
                      <input
                        type="number"
                        placeholder="Aantal"
                        value={partForm.aantal}
                        onChange={(e) =>
                          setPartForm((p) => ({
                            ...p,
                            aantal: Number(e.target.value) || 0,
                          }))
                        }
                        min="0"
                        step="0.01"
                      />
                      <input
                        placeholder="Eenheid"
                        value={partForm.eenheid}
                        onChange={(e) =>
                          setPartForm((p) => ({ ...p, eenheid: e.target.value }))
                        }
                      />
                      <input
                        type="number"
                        placeholder="Prijs/stuk"
                        value={partForm.prijs_per_stuk || ''}
                        onChange={(e) =>
                          setPartForm((p) => ({
                            ...p,
                            prijs_per_stuk: Number(e.target.value) || 0,
                          }))
                        }
                        min="0"
                        step="0.01"
                      />
                      <button
                        onClick={() => handleAddPart(repair.id)}
                        disabled={!partForm.selectedPartId || addPartMutation.isPending}
                        className="btn-primary"
                      >
                        Toevoegen
                      </button>
                    </div>
                  )}

                  <table className="parts-table">
                    <thead>
                      <tr>
                        <th>Omschrijving</th>
                        <th>Aantal</th>
                        <th>Eenheid</th>
                        <th>Prijs/stuk</th>
                        <th>Totaal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(repair.repair_parts ?? []).map((p: RepairPart) => (
                        <tr key={p.id}>
                          <td>{p.omschrijving}</td>
                          <td>{p.aantal}</td>
                          <td>{p.eenheid}</td>
                          <td>{formatCurrency(p.prijs_per_stuk)}</td>
                          <td>{formatCurrency(p.aantal * p.prijs_per_stuk)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

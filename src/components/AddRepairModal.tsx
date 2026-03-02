import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { VehicleService } from '../services/vehicleService';
import { RepairService } from '../services/repairService';
import type { VehicleWithRelations } from '../types/database';
import type { ReparatieReden } from '../types/database';
import './AddRepairModal.css';

function getLocalDateString(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

const normalizeLicensePlateForSearch = (s: string) =>
  s.replace(/\W/g, '').toLowerCase();

interface AddRepairModalProps {
  onClose: () => void;
}

export default function AddRepairModal({ onClose }: AddRepairModalProps) {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedVehicle, setSelectedVehicle] = useState<VehicleWithRelations | null>(null);
  const [newRepairReden, setNewRepairReden] = useState<ReparatieReden>('reparatie');
  const [newRepairDatum, setNewRepairDatum] = useState<string>(() => getLocalDateString());
  const [newRepairBeschrijving, setNewRepairBeschrijving] = useState('');

  const { data: vehicles = [], isLoading: vehiclesLoading } = useQuery({
    queryKey: ['vehicles'],
    queryFn: () => VehicleService.list(),
  });

  const filteredVehicles = useMemo(() => {
    const q = searchQuery.trim();
    if (!q) return vehicles;
    const normalizedSearch = normalizeLicensePlateForSearch(q);
    const qLower = q.toLowerCase();
    return vehicles.filter((v) => {
      if (normalizeLicensePlateForSearch(v.license_plate).includes(normalizedSearch))
        return true;
      if (v.merk && v.merk.toLowerCase().includes(qLower)) return true;
      if (v.model && v.model.toLowerCase().includes(qLower)) return true;
      if (v.bouwjaar != null && String(v.bouwjaar).includes(q)) return true;
      const structureName = (v.structure as { name?: string } | undefined)?.name;
      if (structureName && structureName.toLowerCase().includes(qLower)) return true;
      const departmentName = (v.department as { name?: string } | undefined)?.name;
      if (departmentName && departmentName.toLowerCase().includes(qLower)) return true;
      return false;
    });
  }, [vehicles, searchQuery]);

  const createRepairMutation = useMutation({
    mutationFn: () =>
      RepairService.create(selectedVehicle!.id, newRepairReden, {
        datum_melding: newRepairDatum || null,
        melding: newRepairBeschrijving.trim() || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['repairs-all'] });
      queryClient.invalidateQueries({ queryKey: ['repair-totals'] });
      queryClient.invalidateQueries({ queryKey: ['repairs', selectedVehicle!.id] });
      onClose();
    },
  });

  const handleSelectVehicle = (v: VehicleWithRelations) => {
    setSelectedVehicle(v);
  };

  const handleBackToVehicleSelect = () => {
    setSelectedVehicle(null);
  };

  const handleSubmitRepair = () => {
    if (!selectedVehicle) return;
    createRepairMutation.mutate();
  };

  const handleClose = () => {
    if (!createRepairMutation.isPending) {
      onClose();
    }
  };

  const structure = selectedVehicle?.structure as { name?: string } | undefined;
  const department = selectedVehicle?.department as { name?: string } | undefined;

  return (
    <div className="add-repair-modal-overlay">
      <div className="add-repair-modal">
        <div className="add-repair-modal-header">
          <h2>
            {selectedVehicle
              ? `Reparatie toevoegen – ${selectedVehicle.license_plate}`
              : 'Nieuwe reparatie'}
          </h2>
          <button
            type="button"
            className="add-repair-modal-close"
            onClick={handleClose}
            aria-label="Sluiten"
          >
            ×
          </button>
        </div>
        <div className="add-repair-modal-body">
          {!selectedVehicle ? (
            <>
              <p className="add-repair-modal-hint">
                Zoek het voertuig op kenteken, afdeling, structuur, merk, model of bouwjaar.
                Selecteer daarna het gewenste voertuig om de reparatie toe te voegen.
              </p>
              <div className="add-repair-search-wrap">
                <Search size={20} className="add-repair-search-icon" aria-hidden />
                <input
                  type="search"
                  className="add-repair-search-input"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Zoeken op kenteken, afdeling, structuur, merk, model, bouwjaar..."
                  aria-label="Zoek voertuig"
                  autoFocus
                />
              </div>
              <div className="add-repair-results-wrap">
                {vehiclesLoading ? (
                  <p className="add-repair-loading">Laden...</p>
                ) : filteredVehicles.length === 0 ? (
                  <p className="add-repair-empty">
                    {searchQuery.trim()
                      ? 'Geen voertuigen gevonden. Probeer een andere zoekterm.'
                      : 'Geen voertuigen geregistreerd.'}
                  </p>
                ) : (
                  <ul className="add-repair-results-list">
                    {filteredVehicles.map((v) => (
                      <li key={v.id}>
                        <button
                          type="button"
                          className="add-repair-result-item"
                          onClick={() => handleSelectVehicle(v)}
                        >
                          <span className="add-repair-result-plate">{v.license_plate}</span>
                          <span className="add-repair-result-details">
                            {v.merk} {v.model}
                            {v.bouwjaar ? ` (${v.bouwjaar})` : ''}
                            {(structure?.name || department?.name) &&
                              ` · ${[structure?.name, department?.name].filter(Boolean).join(' / ')}`}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          ) : (
            <>
              <div className="add-repair-selected-vehicle">
                <span className="add-repair-selected-label">Geselecteerd voertuig:</span>
                <span className="add-repair-selected-value">
                  {selectedVehicle.license_plate} – {selectedVehicle.merk} {selectedVehicle.model}
                  {selectedVehicle.bouwjaar ? ` (${selectedVehicle.bouwjaar})` : ''}
                </span>
                <button
                  type="button"
                  className="add-repair-change-vehicle"
                  onClick={handleBackToVehicleSelect}
                >
                  Ander voertuig kiezen
                </button>
              </div>
              <div className="add-repair-form">
                <div className="add-repair-form-row">
                  <label htmlFor="add-repair-datum">Datum</label>
                  <input
                    id="add-repair-datum"
                    type="date"
                    value={newRepairDatum}
                    onChange={(e) => setNewRepairDatum(e.target.value)}
                  />
                </div>
                <div className="add-repair-form-row">
                  <label htmlFor="add-repair-werkzaamheden">Werkzaamheden</label>
                  <select
                    id="add-repair-werkzaamheden"
                    value={newRepairReden}
                    onChange={(e) => setNewRepairReden(e.target.value as ReparatieReden)}
                  >
                    <option value="reparatie">Reparatie</option>
                    <option value="service">Service</option>
                    <option value="diagnose">Diagnose</option>
                  </select>
                </div>
                <div className="add-repair-form-row add-repair-form-row-full">
                  <label htmlFor="add-repair-beschrijving">
                    Beschrijving van werkzaamheden
                  </label>
                  <textarea
                    id="add-repair-beschrijving"
                    value={newRepairBeschrijving}
                    onChange={(e) => setNewRepairBeschrijving(e.target.value)}
                    placeholder="Beschrijving van de werkzaamheden..."
                    rows={3}
                  />
                </div>
                <div className="add-repair-form-actions">
                  <button
                    type="button"
                    onClick={handleBackToVehicleSelect}
                    className="btn-secondary"
                  >
                    Terug
                  </button>
                  <button
                    type="button"
                    onClick={handleSubmitRepair}
                    disabled={createRepairMutation.isPending}
                    className="btn-primary"
                  >
                    {createRepairMutation.isPending ? 'Bezig...' : 'Reparatie toevoegen'}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

import { useState, useMemo, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Pencil, Trash2, CheckCircle, AlertCircle, AlertTriangle, XCircle, Search, Car } from 'lucide-react';
import {
  VehicleService,
  parseAndValidateVehicleCsv,
  type CsvParseResult,
} from '../services/vehicleService';
import { useAuth } from '../contexts/AuthContext';
import { RepairService } from '../services/repairService';
import { OrganisationService } from '../services/organisationService';
import { BrandsService } from '../services/brandsService';
import ColumnToggle, { type ColumnConfig } from '../components/ColumnToggle';
import VehicleForm from '../components/VehicleForm';
import {
  isValidLicensePlateFormat,
  getLicensePlateValidationMessage,
  formatLicensePlateInput,
} from '../utils/licensePlate';
import { capitalizeFirst } from '../utils/string';
import type { VehicleWithRelations, Inzet } from '../types/database';
import './VehicleManagement.css';

const DEFAULT_COLUMNS: ColumnConfig[] = [
  { key: 'license_plate', label: 'Kenteken', visible: true },
  { key: 'inzet', label: 'Inzet', visible: false },
  { key: 'merk', label: 'Merk', visible: true },
  { key: 'model', label: 'Model', visible: true },
  { key: 'bouwjaar', label: 'Bouwjaar', visible: false },
  { key: 'soort', label: 'Soort', visible: false },
  { key: 'status', label: 'Status', visible: true },
  { key: 'structure', label: 'Structuur', visible: false },
  { key: 'department', label: 'Afdeling', visible: true },
  { key: 'kosten', label: 'Kosten', visible: true },
  { key: 'verzekerd', label: 'Verzekerd', visible: false },
  { key: 'verzekertype', label: 'Verzekertype', visible: false },
];

const formatCurrency = (n: number) =>
  new Intl.NumberFormat('nl-SR', {
    style: 'currency',
    currency: 'SRD',
    currencyDisplay: 'code',
    minimumFractionDigits: 2,
  }).format(n);

const CONFIRM_DELETE_WORD = 'confirm';

const COLUMNS_STORAGE_KEY = 'vehicle-management-columns';

function getInitialColumns(): ColumnConfig[] {
  try {
    const raw = localStorage.getItem(COLUMNS_STORAGE_KEY);
    if (!raw) return DEFAULT_COLUMNS;
    const saved = JSON.parse(raw) as { key: string; visible: boolean }[];
    if (!Array.isArray(saved)) return DEFAULT_COLUMNS;
    const visibleByKey = Object.fromEntries(
      saved.map((s) => [s.key, s.visible]).filter(([_, v]) => typeof v === 'boolean')
    );
    return DEFAULT_COLUMNS.map((col) => ({
      ...col,
      visible: col.key in visibleByKey ? visibleByKey[col.key] : col.visible,
    }));
  } catch {
    return DEFAULT_COLUMNS;
  }
}

const CSV_VOORBEELD = `kenteken,inzet,merk,model,bouwjaar,structuur,afdeling,soort,status,transmissie,aandrijving,chassisnummer,verzekerd,verzekertype,polisnummer,start_datum,eind_datum,opmerking
PA-12-34,Burgerplaat,Toyota,Hilux,2020,BvB,Transport,Pickup,Goed,automaat,4WD,JTFBA61J602000001,Assuria,Casco,POL-001,2025-01-01,2026-01-01,Dienstvoertuig
1234-D,Dienstplaat,Mitsubishi,L200,2019,,,Pickup,Redelijk,manual,2WD,,,,,,
`;

export default function VehicleManagement() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { isSuperUserOrAdmin } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [columns, setColumns] = useState<ColumnConfig[]>(getInitialColumns);
  const [showForm, setShowForm] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState<string | null>(null);
  const [csvParseResult, setCsvParseResult] = useState<CsvParseResult | null>(null);
  const [csvRawContent, setCsvRawContent] = useState<string>('');
  const [vehicleToEdit, setVehicleToEdit] = useState<VehicleWithRelations | null>(null);
  const [licenseCheckError, setLicenseCheckError] = useState<string | null>(null);
  const [vehicleToDelete, setVehicleToDelete] = useState<VehicleWithRelations | null>(null);
  const [deleteConfirmInput, setDeleteConfirmInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | null>(null);

  const { data: vehicles = [], isLoading } = useQuery({
    queryKey: ['vehicles'],
    queryFn: () => VehicleService.list(),
  });

  const { data: costsByVehicle = {} } = useQuery({
    queryKey: ['repair-totals'],
    queryFn: () => RepairService.getTotalCostsByVehicle(),
  });

  const { data: structures = [] } = useQuery({
    queryKey: ['structures'],
    queryFn: () => OrganisationService.listStructures(),
  });

  const { data: brands = [] } = useQuery({
    queryKey: ['brands'],
    queryFn: () => BrandsService.listBrands(),
  });

  const createMutation = useMutation({
    mutationFn: (v: Parameters<typeof VehicleService.create>[0]) =>
      VehicleService.create(v),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicles'] });
      setShowForm(false);
      setVehicleToEdit(null);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: Parameters<typeof VehicleService.update>[1];
    }) => VehicleService.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicles'] });
      setShowForm(false);
      setVehicleToEdit(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => VehicleService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicles'] });
      setVehicleToDelete(null);
      setDeleteConfirmInput('');
    },
  });

  const importCsvMutation = useMutation({
    mutationFn: (csvContent: string) => VehicleService.importFromCsv(csvContent),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['vehicles'] });
      setImportError(null);
      setCsvParseResult(null);
      setCsvRawContent('');
      setImportSuccess(`Import voltooid: ${result.vehicles} voertuig(en) toegevoegd.`);
      fileInputRef.current?.form?.reset();
    },
    onError: (err: Error) => {
      setImportError(err.message);
      setImportSuccess(null);
    },
  });

  const openDeleteModal = (vehicle: VehicleWithRelations) => {
    setVehicleToDelete(vehicle);
    setDeleteConfirmInput('');
  };

  const closeDeleteModal = () => {
    if (!deleteMutation.isPending) {
      setVehicleToDelete(null);
      setDeleteConfirmInput('');
    }
  };

  const canConfirmDelete =
    deleteConfirmInput.trim().toLowerCase() === CONFIRM_DELETE_WORD;

  const handleConfirmDelete = () => {
    if (!vehicleToDelete || !canConfirmDelete) return;
    deleteMutation.mutate(vehicleToDelete.id);
  };

  const handleColumnToggle = (key: string, visible: boolean) => {
    setColumns((prev) =>
      prev.map((c) => (c.key === key ? { ...c, visible } : c))
    );
  };

  useEffect(() => {
    localStorage.setItem(
      COLUMNS_STORAGE_KEY,
      JSON.stringify(columns.map((c) => ({ key: c.key, visible: c.visible })))
    );
  }, [columns]);

  const handleSubmit = async (data: Record<string, unknown>) => {
    const inzet = data.inzet as Inzet;
    const licensePlate = String(data.license_plate ?? '').trim();

    const msg = getLicensePlateValidationMessage(licensePlate, inzet);
    if (msg) {
      setLicenseCheckError(msg);
      return;
    }

    if (!isValidLicensePlateFormat(licensePlate, inzet)) {
      setLicenseCheckError('Ongeldig kentekenformaat');
      return;
    }

    const excludeId = vehicleToEdit?.id;
    const isUnique = await VehicleService.checkLicensePlateUnique(
      licensePlate,
      excludeId
    );
    if (!isUnique) {
      setLicenseCheckError('Kenteken bestaat al in de database');
      return;
    }

    setLicenseCheckError(null);
    const payload = {
      inzet,
      license_plate: formatLicensePlateInput(licensePlate),
      structure_id: (data.structure_id as string) || null,
      department_id: (data.department_id as string) || null,
      merk: String(data.merk ?? ''),
      model: String(data.model ?? ''),
      bouwjaar: data.bouwjaar ? Number(data.bouwjaar) : null,
      soort: (data.soort as VehicleWithRelations['soort']) || null,
      transmissie: (data.transmissie as VehicleWithRelations['transmissie']) || null,
      aandrijving: (data.aandrijving as VehicleWithRelations['aandrijving']) || null,
      chassisnummer: (data.chassisnummer as string)?.trim() || null,
      verzekerd: (data.verzekerd as VehicleWithRelations['verzekerd']) || null,
      verzekertype: (data.verzekertype as VehicleWithRelations['verzekertype']) || null,
      polisnummer: (data.polisnummer as string)?.trim() || null,
      start_datum: (data.start_datum as string) || null,
      eind_datum: (data.eind_datum as string) || null,
      opmerking: (data.opmerking as string) || null,
      status: (data.status as VehicleWithRelations['status']) ?? 'Goed',
    };
    if (vehicleToEdit) {
      updateMutation.mutate({ id: vehicleToEdit.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const openCreateForm = () => {
    setVehicleToEdit(null);
    setLicenseCheckError(null);
    setShowForm(true);
  };

  const openEditForm = (vehicle: VehicleWithRelations) => {
    setVehicleToEdit(vehicle);
    setLicenseCheckError(null);
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setVehicleToEdit(null);
    setLicenseCheckError(null);
  };

  const handleOpenImportModal = () => {
    if (!isSuperUserOrAdmin()) return;
    setImportModalOpen(true);
    setImportError(null);
    setImportSuccess(null);
    setCsvParseResult(null);
    setCsvRawContent('');
  };

  const handleCloseImportModal = () => {
    setImportModalOpen(false);
    setImportError(null);
    setImportSuccess(null);
    setCsvParseResult(null);
    setCsvRawContent('');
    fileInputRef.current?.form?.reset();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.csv')) {
      setImportError('Selecteer een CSV-bestand.');
      setCsvParseResult(null);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const text = reader.result as string;
      setImportError(null);
      setImportSuccess(null);
      const result = parseAndValidateVehicleCsv(text);
      setCsvParseResult(result);
      setCsvRawContent(text);
    };
    reader.readAsText(file, 'UTF-8');
  };

  const handleAcceptImport = () => {
    if (csvRawContent && csvParseResult?.valid) {
      importCsvMutation.mutate(csvRawContent);
    }
  };

  const handleRejectImport = () => {
    setCsvParseResult(null);
    setCsvRawContent('');
    setImportError(null);
    fileInputRef.current?.form?.reset();
  };

  const handleDownloadVoorbeeld = () => {
    const blob = new Blob([CSV_VOORBEELD], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'voertuigen_voorbeeld.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const colMap = useMemo(
    () => Object.fromEntries(columns.map((c) => [c.key, c.visible])),
    [columns]
  );

  const statusCounts = useMemo(() => {
    const counts = { goed: 0, redelijk: 0, slecht: 0, defect: 0 };
    for (const v of vehicles) {
      const s = String(v.status).toLowerCase();
      if (s in counts) counts[s as keyof typeof counts]++;
    }
    return counts;
  }, [vehicles]);

  /** Kenteken normaliseren voor zoeken: alleen letters en cijfers, lowercase (bijv. PA-21-01 → pa2101). */
  const normalizeLicensePlateForSearch = (s: string) =>
    s.replace(/\W/g, '').toLowerCase();

  const toggleStatusFilter = (status: string) => {
    setStatusFilter((prev) => (prev === status ? null : status));
  };

  const filteredVehicles = useMemo(() => {
    let result = vehicles;
    if (statusFilter) {
      result = result.filter(
        (v) => String(v.status).toLowerCase() === statusFilter
      );
    }
    const q = searchQuery.trim();
    if (!q) return result;
    const normalizedSearch = normalizeLicensePlateForSearch(q);
    const qLower = q.toLowerCase();
    return result.filter((v) => {
      if (normalizeLicensePlateForSearch(v.license_plate).includes(normalizedSearch))
        return true;
      if (v.merk && v.merk.toLowerCase().includes(qLower)) return true;
      if (v.model && v.model.toLowerCase().includes(qLower)) return true;
      const structureName = (v.structure as { name?: string } | undefined)?.name;
      if (structureName && structureName.toLowerCase().includes(qLower)) return true;
      const departmentName = (v.department as { name?: string } | undefined)?.name;
      if (departmentName && departmentName.toLowerCase().includes(qLower)) return true;
      return false;
    });
  }, [vehicles, searchQuery, statusFilter]);

  return (
    <div className="vehicle-management">
      <div className="vehicle-management-header">
        <h1>Voertuigbeheer</h1>
        <div className="vehicle-management-actions">
          {isSuperUserOrAdmin() && (
            <button
              type="button"
              className="btn-import"
              onClick={handleOpenImportModal}
            >
              Import CSV
            </button>
          )}
          <button onClick={openCreateForm} className="btn-primary">
            Nieuw voertuig
          </button>
        </div>
      </div>

      <div className="vehicle-management-stats">
        <button
          type="button"
          className={`vehicle-stat-card vehicle-stat-totaal${statusFilter === null ? ' vehicle-stat-active' : ''}`}
          onClick={() => setStatusFilter(null)}
        >
          <Car size={28} aria-hidden />
          <div className="vehicle-stat-content">
            <span className="vehicle-stat-value">{vehicles.length}</span>
            <span className="vehicle-stat-label">Totaal</span>
          </div>
        </button>
        <button
          type="button"
          className={`vehicle-stat-card vehicle-stat-goed${statusFilter === 'goed' ? ' vehicle-stat-active' : ''}`}
          onClick={() => toggleStatusFilter('goed')}
        >
          <CheckCircle size={28} aria-hidden />
          <div className="vehicle-stat-content">
            <span className="vehicle-stat-value">{statusCounts.goed}</span>
            <span className="vehicle-stat-label">Goed</span>
          </div>
        </button>
        <button
          type="button"
          className={`vehicle-stat-card vehicle-stat-redelijk${statusFilter === 'redelijk' ? ' vehicle-stat-active' : ''}`}
          onClick={() => toggleStatusFilter('redelijk')}
        >
          <AlertCircle size={28} aria-hidden />
          <div className="vehicle-stat-content">
            <span className="vehicle-stat-value">{statusCounts.redelijk}</span>
            <span className="vehicle-stat-label">Redelijk</span>
          </div>
        </button>
        <button
          type="button"
          className={`vehicle-stat-card vehicle-stat-slecht${statusFilter === 'slecht' ? ' vehicle-stat-active' : ''}`}
          onClick={() => toggleStatusFilter('slecht')}
        >
          <AlertTriangle size={28} aria-hidden />
          <div className="vehicle-stat-content">
            <span className="vehicle-stat-value">{statusCounts.slecht}</span>
            <span className="vehicle-stat-label">Slecht</span>
          </div>
        </button>
        <button
          type="button"
          className={`vehicle-stat-card vehicle-stat-defect${statusFilter === 'defect' ? ' vehicle-stat-active' : ''}`}
          onClick={() => toggleStatusFilter('defect')}
        >
          <XCircle size={28} aria-hidden />
          <div className="vehicle-stat-content">
            <span className="vehicle-stat-value">{statusCounts.defect}</span>
            <span className="vehicle-stat-label">Defect</span>
          </div>
        </button>
      </div>

      <div className="vehicle-management-columns-row">
        <div className="vehicle-management-search-wrap">
          <Search size={20} className="vehicle-management-search-icon" aria-hidden />
          <input
            type="search"
            className="vehicle-management-search-input"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Zoeken op kenteken, merk, model, structuur of afdeling"
            aria-label="Zoeken op kenteken"
          />
        </div>
        <ColumnToggle columns={columns} onToggle={handleColumnToggle} />
      </div>

      {importModalOpen && (
        <div className="modal-overlay" onClick={handleCloseImportModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Voertuigen importeren</h2>
              <button
                type="button"
                className="modal-close"
                onClick={handleCloseImportModal}
                aria-label="Sluiten"
              >
                ×
              </button>
            </div>
            <div className="modal-body">
              {!csvParseResult ? (
                <>
                  <p className="modal-hint">
                    Upload een CSV-bestand. Verplichte kolommen zijn gemarkeerd met <span className="csv-required-marker">*</span>.
                  </p>
                  <div className="csv-columns-overview">
                    <div className="csv-columns-group">
                      <span className="csv-columns-label">Verplicht:</span>
                      <span>kenteken, inzet, merk, model</span>
                    </div>
                    <div className="csv-columns-group">
                      <span className="csv-columns-label">Optioneel:</span>
                      <span>bouwjaar, structuur, afdeling, soort, status, transmissie, aandrijving, chassisnummer, verzekerd, verzekertype, polisnummer, start_datum, eind_datum, opmerking</span>
                    </div>
                  </div>

                  <form className="import-upload" onSubmit={(e) => e.preventDefault()}>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".csv"
                      onChange={handleFileChange}
                      id="csv-upload"
                      className="import-file-input"
                    />
                    <label htmlFor="csv-upload" className="import-dropzone">
                      Klik om CSV te selecteren of sleep bestand hier
                    </label>
                  </form>

                  <div className="import-actions">
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={handleDownloadVoorbeeld}
                    >
                      Voorbeeld CSV downloaden
                    </button>
                  </div>
                </>
              ) : !csvParseResult.valid ? (
                <>
                  <h3 className="import-errors-title">Fouten in het CSV-bestand</h3>
                  <p className="modal-hint">
                    Corrigeer de onderstaande fouten en upload het bestand opnieuw.
                  </p>
                  <ul className="import-errors-list">
                    {csvParseResult.errors.map((err, idx) => (
                      <li key={idx}>{err}</li>
                    ))}
                  </ul>
                  <div className="import-actions">
                    <form onSubmit={(e) => e.preventDefault()}>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".csv"
                        onChange={handleFileChange}
                        id="csv-upload-retry"
                        className="import-file-input"
                      />
                      <label htmlFor="csv-upload-retry" className="btn-secondary">
                        Ander bestand kiezen
                      </label>
                    </form>
                  </div>
                </>
              ) : importCsvMutation.isPending ? (
                <p className="import-message import-pending">
                  Bezig met importeren...
                </p>
              ) : (
                <>
                  <h3 className="import-preview-title">Preview – eerste 7 records</h3>
                  <p className="modal-hint">
                    Controleer de gegevens en kies Accepteren om te importeren of Afwijzen om te annuleren.
                  </p>
                  <div className="import-preview-table-wrap">
                    <table className="import-preview-table">
                      <thead>
                        <tr>
                          <th>Kenteken <span className="csv-required-marker">*</span></th>
                          <th>Inzet <span className="csv-required-marker">*</span></th>
                          <th>Merk <span className="csv-required-marker">*</span></th>
                          <th>Model <span className="csv-required-marker">*</span></th>
                          <th>Bouwjaar</th>
                          <th>Structuur</th>
                          <th>Afdeling</th>
                          <th>Soort</th>
                          <th>Status</th>
                          <th>Transmissie</th>
                          <th>Aandrijving</th>
                          <th>Chassisnr.</th>
                          <th>Verzekerd</th>
                          <th>Verzekertype</th>
                          <th>Polisnr.</th>
                          <th>Start datum</th>
                          <th>Eind datum</th>
                          <th>Opmerking</th>
                        </tr>
                      </thead>
                      <tbody>
                        {csvParseResult.previewRows.map((row, idx) => (
                          <tr key={idx}>
                            <td>{row.kenteken}</td>
                            <td>{row.inzet}</td>
                            <td>{row.merk}</td>
                            <td>{row.model}</td>
                            <td>{row.bouwjaar || '—'}</td>
                            <td>{row.structuur || '—'}</td>
                            <td>{row.afdeling || '—'}</td>
                            <td>{row.soort}</td>
                            <td>{row.status}</td>
                            <td>{row.transmissie || '—'}</td>
                            <td>{row.aandrijving || '—'}</td>
                            <td>{row.chassisnummer || '—'}</td>
                            <td>{row.verzekerd || '—'}</td>
                            <td>{row.verzekertype || '—'}</td>
                            <td>{row.polisnummer || '—'}</td>
                            <td>{row.start_datum || '—'}</td>
                            <td>{row.eind_datum || '—'}</td>
                            <td className="csv-opmerking-cell">{row.opmerking || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="import-preview-meta">
                    Totaal {csvParseResult.totalDataRows} rij(en) in bestand.
                  </p>
                  <div className="import-preview-actions">
                    <button
                      type="button"
                      className="btn-import-accept"
                      onClick={handleAcceptImport}
                    >
                      Accepteren en importeren
                    </button>
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={handleRejectImport}
                    >
                      Afwijzen
                    </button>
                  </div>
                </>
              )}

              {importError && (
                <p className="import-message import-error">{importError}</p>
              )}
              {importSuccess && (
                <p className="import-message import-success">{importSuccess}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {showForm && (
        <VehicleForm
          structures={structures}
          brands={brands}
          onClose={closeForm}
          onSubmit={handleSubmit}
          error={licenseCheckError}
          createLoading={createMutation.isPending}
          editLoading={updateMutation.isPending}
          initialVehicle={vehicleToEdit}
        />
      )}

      {vehicleToDelete && (
        <div className="vehicle-delete-modal-overlay" onClick={closeDeleteModal}>
          <div
            className="vehicle-delete-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <h3>Voertuig verwijderen</h3>
            <p>
              Weet u zeker dat u <strong>{vehicleToDelete.license_plate}</strong>{' '}
              wilt verwijderen? Typ <strong>Confirm</strong> om te bevestigen.
            </p>
            <input
              type="text"
              className="vehicle-delete-confirm-input"
              value={deleteConfirmInput}
              onChange={(e) => setDeleteConfirmInput(e.target.value)}
              placeholder="Typ Confirm"
              autoFocus
              disabled={deleteMutation.isPending}
            />
            <div className="vehicle-delete-modal-actions">
              <button
                type="button"
                className="btn-secondary"
                onClick={closeDeleteModal}
                disabled={deleteMutation.isPending}
              >
                Annuleren
              </button>
              <button
                type="button"
                className="btn-danger"
                onClick={handleConfirmDelete}
                disabled={!canConfirmDelete || deleteMutation.isPending}
              >
                {deleteMutation.isPending ? 'Verwijderen...' : 'Verwijderen'}
              </button>
            </div>
          </div>
        </div>
      )}

      {isLoading ? (
        <p>Laden...</p>
      ) : (
        <div className="vehicle-management-table-wrap">
          <table className="vehicle-management-table">
            <thead>
              <tr>
                {colMap.license_plate && <th>Kenteken</th>}
                {colMap.inzet && <th>Inzet</th>}
                {colMap.merk && <th>Merk</th>}
                {colMap.model && <th>Model</th>}
                {colMap.bouwjaar && <th>Bouwjaar</th>}
                {colMap.soort && <th>Soort</th>}
                {colMap.status && <th>Status</th>}
                {colMap.structure && <th>Structuur</th>}
                {colMap.department && <th>Afdeling</th>}
                {colMap.kosten && <th>Kosten</th>}
                {colMap.verzekerd && <th>Verzekerd</th>}
                {colMap.verzekertype && <th>Verzekertype</th>}
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filteredVehicles.map((v) => (
                <tr
                  key={v.id}
                  className="vehicle-management-row-clickable"
                  onClick={() => navigate(`/automontage/voertuig/${v.id}`)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      navigate(`/automontage/voertuig/${v.id}`);
                    }
                  }}
                  role="button"
                  tabIndex={0}
                >
                  <>
                    {colMap.license_plate && (
                      <td>{v.license_plate}</td>
                    )}
                    {colMap.inzet && <td>{capitalizeFirst(v.inzet)}</td>}
                    {colMap.merk && <td>{v.merk}</td>}
                    {colMap.model && <td>{v.model}</td>}
                    {colMap.bouwjaar && <td>{v.bouwjaar ?? '-'}</td>}
                    {colMap.soort && <td>{v.soort ? capitalizeFirst(v.soort) : '-'}</td>}
                    {colMap.status && (
                      <td>
                        <span className={`status-badge status-${String(v.status).toLowerCase()}`}>
                          {capitalizeFirst(v.status)}
                        </span>
                      </td>
                    )}
                    {colMap.structure && (
                      <td>{(v.structure as { name?: string })?.name ?? '-'}</td>
                    )}
                    {colMap.department && (
                      <td>{(v.department as { name?: string })?.name ?? '-'}</td>
                    )}
                    {colMap.kosten && (
                      <td>{formatCurrency(costsByVehicle[v.id] ?? 0)}</td>
                    )}
                    {colMap.verzekerd && <td>{v.verzekerd ? capitalizeFirst(v.verzekerd) : '-'}</td>}
                    {colMap.verzekertype && <td>{v.verzekertype ? capitalizeFirst(v.verzekertype) : '-'}</td>}
                    <td
                      className="vehicle-management-actions-cell"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        className="vehicle-action-btn vehicle-action-edit"
                        onClick={() => openEditForm(v)}
                        title="Bewerken"
                        aria-label="Bewerken"
                      >
                        <Pencil size={18} />
                      </button>
                      <button
                        type="button"
                        className="vehicle-action-btn vehicle-action-delete"
                        onClick={() => openDeleteModal(v)}
                        title="Verwijderen"
                        aria-label="Verwijderen"
                      >
                        <Trash2 size={18} />
                      </button>
                    </td>
                  </>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, Pencil, Trash2 } from 'lucide-react';
import {
  OrganisationService,
  parseAndValidateCsv,
  type CsvParseResult,
} from '../services/organisationService';
import type { Structure, Department, Rank } from '../types/database';
import './Organisatie.css';

const CSV_VOORBEELD = `structuur,structuurbeschrijving,afdeling,afdelingbeschrijving
HRM,Human Resource Management,Dienstverlening,
HRM,,P&O,Personeelsmanagement & Organisatie
BvB,Beleidsvoorbereiding en Beheer,,
`;

export default function Organisatie() {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [expandedStructureIds, setExpandedStructureIds] = useState<Set<string>>(new Set());
  const [editingStructure, setEditingStructure] = useState<Structure | null>(null);
  const [editStructureName, setEditStructureName] = useState('');
  const [editStructureBeschrijving, setEditStructureBeschrijving] = useState('');
  const [editingDept, setEditingDept] = useState<Department | null>(null);
  const [editDeptName, setEditDeptName] = useState('');
  const [editDeptBeschrijving, setEditDeptBeschrijving] = useState('');
  const [addingStructure, setAddingStructure] = useState(false);
  const [newStructureName, setNewStructureName] = useState('');
  const [newStructureBeschrijving, setNewStructureBeschrijving] = useState('');
  const [addingDeptForStructureId, setAddingDeptForStructureId] = useState<string | null>(null);
  const [newDeptName, setNewDeptName] = useState('');
  const [newDeptBeschrijving, setNewDeptBeschrijving] = useState('');
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState<string | null>(null);
  const [csvParseResult, setCsvParseResult] = useState<CsvParseResult | null>(null);
  const [csvRawContent, setCsvRawContent] = useState<string>('');
  const [addingRank, setAddingRank] = useState(false);
  const [newRankName, setNewRankName] = useState('');
  const [newRankAfkorting, setNewRankAfkorting] = useState('');
  const [editingRank, setEditingRank] = useState<Rank | null>(null);
  const [editRankName, setEditRankName] = useState('');
  const [editRankAfkorting, setEditRankAfkorting] = useState('');

  const { data: structures = [], isLoading: structuresLoading } = useQuery({
    queryKey: ['structures'],
    queryFn: () => OrganisationService.listStructures(),
  });

  const { data: departments = [] } = useQuery({
    queryKey: ['departments'],
    queryFn: () => OrganisationService.listDepartments(),
  });

  const { data: ranks = [], isLoading: ranksLoading } = useQuery({
    queryKey: ['ranks'],
    queryFn: () => OrganisationService.listRanks(),
  });

  const departmentsByStructure = departments.reduce<Record<string, Department[]>>((acc, d) => {
    if (!acc[d.structure_id]) acc[d.structure_id] = [];
    acc[d.structure_id].push(d);
    return acc;
  }, {});
  for (const id of Object.keys(departmentsByStructure)) {
    departmentsByStructure[id].sort((a, b) => a.name.localeCompare(b.name));
  }

  const toggleExpand = (id: string) => {
    setExpandedStructureIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const createStructureMutation = useMutation({
    mutationFn: ({ name, beschrijving }: { name: string; beschrijving?: string }) =>
      OrganisationService.createStructure(name, beschrijving || null),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['structures'] });
      setAddingStructure(false);
      setNewStructureName('');
      setNewStructureBeschrijving('');
    },
  });

  const updateStructureMutation = useMutation({
    mutationFn: ({
      id,
      name,
      beschrijving,
    }: {
      id: string;
      name: string;
      beschrijving?: string | null;
    }) => OrganisationService.updateStructure(id, name, beschrijving ?? null),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['structures'] });
      setEditingStructure(null);
    },
  });

  const deleteStructureMutation = useMutation({
    mutationFn: (id: string) => OrganisationService.deleteStructure(id),
    onSuccess: (_data, deletedId) => {
      queryClient.invalidateQueries({ queryKey: ['structures'] });
      queryClient.invalidateQueries({ queryKey: ['departments'] });
      setExpandedStructureIds((prev) => {
        const next = new Set(prev);
        next.delete(deletedId);
        return next;
      });
    },
  });

  const createDeptMutation = useMutation({
    mutationFn: ({
      structureId,
      name,
      beschrijving,
    }: {
      structureId: string;
      name: string;
      beschrijving?: string;
    }) => OrganisationService.createDepartment(structureId, name, beschrijving || null),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['departments'] });
      setAddingDeptForStructureId(null);
      setNewDeptName('');
      setNewDeptBeschrijving('');
    },
  });

  const updateDeptMutation = useMutation({
    mutationFn: ({
      id,
      name,
      beschrijving,
    }: {
      id: string;
      name: string;
      beschrijving?: string | null;
    }) => OrganisationService.updateDepartment(id, name, beschrijving ?? null),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['departments'] });
      setEditingDept(null);
    },
  });

  const deleteDeptMutation = useMutation({
    mutationFn: (id: string) => OrganisationService.deleteDepartment(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['departments'] });
    },
  });

  const createRankMutation = useMutation({
    mutationFn: ({ rang, afkorting }: { rang: string; afkorting: string }) =>
      OrganisationService.createRank(rang, afkorting),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ranks'] });
      setAddingRank(false);
      setNewRankName('');
      setNewRankAfkorting('');
    },
  });

  const updateRankMutation = useMutation({
    mutationFn: ({ id, rang, afkorting }: { id: string; rang: string; afkorting: string }) =>
      OrganisationService.updateRank(id, rang, afkorting),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ranks'] });
      setEditingRank(null);
      setEditRankName('');
      setEditRankAfkorting('');
    },
  });

  const deleteRankMutation = useMutation({
    mutationFn: (id: string) => OrganisationService.deleteRank(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ranks'] });
    },
  });

  const moveRankMutation = useMutation({
    mutationFn: ({ id, direction }: { id: string; direction: 'up' | 'down' }) =>
      OrganisationService.moveRank(id, direction),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ranks'] });
    },
  });

  const importCsvMutation = useMutation({
    mutationFn: (csvContent: string) => OrganisationService.importFromCsv(csvContent),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['structures'] });
      queryClient.invalidateQueries({ queryKey: ['departments'] });
      setImportError(null);
      setCsvParseResult(null);
      setCsvRawContent('');
      setImportSuccess(
        `Import voltooid: ${result.structures} structuur(structuren) en ${result.departments} afdeling(afdelingen) toegevoegd.`
      );
      fileInputRef.current?.form?.reset();
    },
    onError: (err: Error) => {
      setImportError(err.message);
      setImportSuccess(null);
    },
  });

  const handleStartEditStructure = (s: Structure) => {
    setEditingStructure(s);
    setEditStructureName(s.name);
    setEditStructureBeschrijving(s.beschrijving ?? '');
  };

  const handleStartEditDept = (d: Department) => {
    setEditingDept(d);
    setEditDeptName(d.name);
    setEditDeptBeschrijving(d.beschrijving ?? '');
  };

  const handleOpenImportModal = () => {
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
      const result = parseAndValidateCsv(text);
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
    a.download = 'organisatie_voorbeeld.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleStartEditRank = (rank: Rank) => {
    setEditingRank(rank);
    setEditRankName(rank.rang);
    setEditRankAfkorting(rank.afkorting);
  };

  return (
    <div className="organisatie">
      <div className="organisatie-header">
        <div>
          <h1>Organisatie</h1>
          <p className="organisatie-desc">
            Beheer structuren en afdelingen. Afdelingen vallen onder structuren.
          </p>
        </div>
        <button type="button" className="btn-import" onClick={handleOpenImportModal}>
          Import CSV
        </button>
      </div>

      {importModalOpen && (
        <div className="modal-overlay" onClick={handleCloseImportModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Organisatie importeren</h2>
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
                    Upload een CSV-bestand met kolommen <strong>structuur</strong> en{' '}
                    <strong>afdeling</strong>. Optioneel: <strong>structuurbeschrijving</strong> en{' '}
                    <strong>afdelingbeschrijving</strong>.
                  </p>

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
                          <th>Structuur</th>
                          <th>Structuurbeschrijving</th>
                          <th>Afdeling</th>
                          <th>Afdelingbeschrijving</th>
                        </tr>
                      </thead>
                      <tbody>
                        {csvParseResult.previewRows.map((row, idx) => (
                          <tr key={idx}>
                            <td>{row.structuur || '—'}</td>
                            <td>{row.structuurbeschrijving || '—'}</td>
                            <td>{row.afdeling || '—'}</td>
                            <td>{row.afdelingbeschrijving || '—'}</td>
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

      <div className="organisatie-tree-section">
        <div className="organisatie-tree-toolbar">
          <button
            type="button"
            className="btn-add-structure"
            onClick={() => setAddingStructure(true)}
          >
            + Structuur toevoegen
          </button>
        </div>

        {addingStructure && (
          <div className="organisatie-tree-item organisatie-tree-item-add">
            <div className="organisatie-edit-form">
              <input
                placeholder="Structuur (bijv. HRM)"
                value={newStructureName}
                onChange={(e) => setNewStructureName(e.target.value)}
                autoFocus
              />
              <input
                placeholder="Structuurbeschrijving (bijv. Human Resource Management)"
                value={newStructureBeschrijving}
                onChange={(e) => setNewStructureBeschrijving(e.target.value)}
              />
              <div className="organisatie-edit-actions">
                <button
                  onClick={() =>
                    newStructureName.trim() &&
                    createStructureMutation.mutate({
                      name: newStructureName.trim(),
                      beschrijving: newStructureBeschrijving.trim() || undefined,
                    })
                  }
                  disabled={!newStructureName.trim()}
                >
                  Opslaan
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    setAddingStructure(false);
                    setNewStructureName('');
                    setNewStructureBeschrijving('');
                  }}
                >
                  Annuleren
                </button>
              </div>
            </div>
          </div>
        )}

        {structuresLoading ? (
          <p className="organisatie-loading">Laden...</p>
        ) : (
          <ul className="organisatie-tree">
            {structures.map((s) => (
              <li key={s.id} className="organisatie-tree-node">
                <div className="organisatie-tree-item organisatie-tree-item-structure">
                  <button
                    type="button"
                    className="organisatie-tree-expand"
                    onClick={() => toggleExpand(s.id)}
                    aria-label={expandedStructureIds.has(s.id) ? 'Inklappen' : 'Uitklappen'}
                  >
                    {expandedStructureIds.has(s.id) ? '▼' : '►'}
                  </button>
                  <div className="organisatie-tree-content">
                    {editingStructure?.id === s.id ? (
                      <div className="organisatie-edit-form">
                        <input
                          placeholder="Structuur"
                          value={editStructureName}
                          onChange={(e) => setEditStructureName(e.target.value)}
                          autoFocus
                        />
                        <input
                          placeholder="Structuurbeschrijving"
                          value={editStructureBeschrijving}
                          onChange={(e) => setEditStructureBeschrijving(e.target.value)}
                        />
                        <div className="organisatie-edit-actions">
                          <button
                            onClick={() =>
                              updateStructureMutation.mutate({
                                id: s.id,
                                name: editStructureName.trim(),
                                beschrijving: editStructureBeschrijving.trim() || null,
                              })
                            }
                            disabled={!editStructureName.trim()}
                          >
                            Opslaan
                          </button>
                          <button
                            type="button"
                            className="btn-secondary"
                            onClick={() => setEditingStructure(null)}
                          >
                            Annuleren
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="organisatie-tree-label">
                          <span className="organisatie-tree-name">{s.name}</span>
                          {s.beschrijving && (
                            <span className="organisatie-tree-desc">{s.beschrijving}</span>
                          )}
                        </div>
                        <div className="organisatie-tree-actions">
                          <button
                            type="button"
                            className="btn-icon btn-add"
                            onClick={() => {
                              setAddingDeptForStructureId(s.id);
                              setExpandedStructureIds((prev) => new Set(prev).add(s.id));
                            }}
                            title="Afdeling toevoegen"
                          >
                            +
                          </button>
                          <button
                            type="button"
                            className="btn-icon"
                            onClick={() => handleStartEditStructure(s)}
                            title="Bewerken"
                          >
                            ✎
                          </button>
                          <button
                            type="button"
                            className="btn-icon btn-danger"
                            onClick={() =>
                              confirm('Structuur verwijderen?') &&
                              deleteStructureMutation.mutate(s.id)
                            }
                            title="Verwijderen"
                          >
                            🗑
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {expandedStructureIds.has(s.id) && (
                  <ul className="organisatie-tree-children">
                    {addingDeptForStructureId === s.id && (
                      <li className="organisatie-tree-item organisatie-tree-item-add organisatie-tree-item-child">
                        <div className="organisatie-edit-form">
                          <input
                            placeholder="Afdeling (bijv. P&O)"
                            value={newDeptName}
                            onChange={(e) => setNewDeptName(e.target.value)}
                            autoFocus
                          />
                          <input
                            placeholder="Afdelingbeschrijving (bijv. Personeelsmanagement & Organisatie)"
                            value={newDeptBeschrijving}
                            onChange={(e) => setNewDeptBeschrijving(e.target.value)}
                          />
                          <div className="organisatie-edit-actions">
                            <button
                              onClick={() =>
                                newDeptName.trim() &&
                                createDeptMutation.mutate({
                                  structureId: s.id,
                                  name: newDeptName.trim(),
                                  beschrijving: newDeptBeschrijving.trim() || undefined,
                                })
                              }
                              disabled={!newDeptName.trim()}
                            >
                              Opslaan
                            </button>
                            <button
                              type="button"
                              className="btn-secondary"
                              onClick={() => {
                                setAddingDeptForStructureId(null);
                                setNewDeptName('');
                                setNewDeptBeschrijving('');
                              }}
                            >
                              Annuleren
                            </button>
                          </div>
                        </div>
                      </li>
                    )}
                    {(departmentsByStructure[s.id] ?? []).map((d) => (
                      <li key={d.id} className="organisatie-tree-item organisatie-tree-item-child">
                        <div className="organisatie-tree-content">
                          {editingDept?.id === d.id ? (
                            <div className="organisatie-edit-form">
                              <input
                                placeholder="Afdeling"
                                value={editDeptName}
                                onChange={(e) => setEditDeptName(e.target.value)}
                                autoFocus
                              />
                              <input
                                placeholder="Afdelingbeschrijving"
                                value={editDeptBeschrijving}
                                onChange={(e) => setEditDeptBeschrijving(e.target.value)}
                              />
                              <div className="organisatie-edit-actions">
                                <button
                                  onClick={() =>
                                    updateDeptMutation.mutate({
                                      id: d.id,
                                      name: editDeptName.trim(),
                                      beschrijving: editDeptBeschrijving.trim() || null,
                                    })
                                  }
                                  disabled={!editDeptName.trim()}
                                >
                                  Opslaan
                                </button>
                                <button
                                  type="button"
                                  className="btn-secondary"
                                  onClick={() => setEditingDept(null)}
                                >
                                  Annuleren
                                </button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <div className="organisatie-tree-label">
                                <span className="organisatie-tree-name">{d.name}</span>
                                {d.beschrijving && (
                                  <span className="organisatie-tree-desc">{d.beschrijving}</span>
                                )}
                              </div>
                              <div className="organisatie-tree-actions">
                                <button
                                  type="button"
                                  className="btn-icon"
                                  onClick={() => handleStartEditDept(d)}
                                  title="Bewerken"
                                >
                                  ✎
                                </button>
                                <button
                                  type="button"
                                  className="btn-icon btn-danger"
                                  onClick={() =>
                                    confirm('Afdeling verwijderen?') &&
                                    deleteDeptMutation.mutate(d.id)
                                  }
                                  title="Verwijderen"
                                >
                                  🗑
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <section className="organisatie-ranks-section">
        <div className="organisatie-ranks-header">
          <div>
            <h2>Rangen</h2>
            <p className="organisatie-ranks-desc">
              Overzicht van politierangen en hun afkortingen.
            </p>
          </div>
          <button
            type="button"
            className="btn-add-structure"
            onClick={() => setAddingRank(true)}
          >
            + Rang toevoegen
          </button>
        </div>

        <div className="organisatie-ranks-table-wrap">
          <table className="organisatie-ranks-table">
            <thead>
              <tr>
                <th>Rang</th>
                <th>Afkorting</th>
                <th>Acties</th>
              </tr>
            </thead>
            <tbody>
              {addingRank && (
                <tr>
                  <td>
                    <input
                      className="organisatie-ranks-input"
                      placeholder="Rang"
                      value={newRankName}
                      onChange={(e) => setNewRankName(e.target.value)}
                      autoFocus
                    />
                  </td>
                  <td>
                    <input
                      className="organisatie-ranks-input"
                      placeholder="Afkorting"
                      value={newRankAfkorting}
                      onChange={(e) => setNewRankAfkorting(e.target.value)}
                    />
                  </td>
                  <td>
                    <div className="organisatie-ranks-row-actions">
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() =>
                          createRankMutation.mutate({
                            rang: newRankName.trim(),
                            afkorting: newRankAfkorting.trim(),
                          })
                        }
                        disabled={!newRankName.trim() || !newRankAfkorting.trim()}
                      >
                        Opslaan
                      </button>
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() => {
                          setAddingRank(false);
                          setNewRankName('');
                          setNewRankAfkorting('');
                        }}
                      >
                        Annuleren
                      </button>
                    </div>
                  </td>
                </tr>
              )}

              {ranksLoading ? (
                <tr>
                  <td colSpan={3} className="organisatie-ranks-empty">
                    Laden...
                  </td>
                </tr>
              ) : ranks.length === 0 ? (
                <tr>
                  <td colSpan={3} className="organisatie-ranks-empty">
                    Nog geen rangen toegevoegd.
                  </td>
                </tr>
              ) : (
                ranks.map((rank, index) => (
                  <tr key={rank.id}>
                    {editingRank?.id === rank.id ? (
                      <>
                        <td>
                          <input
                            className="organisatie-ranks-input"
                            placeholder="Rang"
                            value={editRankName}
                            onChange={(e) => setEditRankName(e.target.value)}
                            autoFocus
                          />
                        </td>
                        <td>
                          <input
                            className="organisatie-ranks-input"
                            placeholder="Afkorting"
                            value={editRankAfkorting}
                            onChange={(e) => setEditRankAfkorting(e.target.value)}
                          />
                        </td>
                        <td>
                          <div className="organisatie-ranks-row-actions">
                            <button
                              type="button"
                              className="btn-secondary"
                              onClick={() =>
                                updateRankMutation.mutate({
                                  id: rank.id,
                                  rang: editRankName.trim(),
                                  afkorting: editRankAfkorting.trim(),
                                })
                              }
                              disabled={!editRankName.trim() || !editRankAfkorting.trim()}
                            >
                              Opslaan
                            </button>
                            <button
                              type="button"
                              className="btn-secondary"
                              onClick={() => {
                                setEditingRank(null);
                                setEditRankName('');
                                setEditRankAfkorting('');
                              }}
                            >
                              Annuleren
                            </button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td>{rank.rang}</td>
                        <td>{rank.afkorting}</td>
                        <td>
                          <div className="organisatie-ranks-icon-actions">
                            <button
                              type="button"
                              className="organisatie-ranks-action-btn"
                              onClick={() => moveRankMutation.mutate({ id: rank.id, direction: 'up' })}
                              title="Omhoog"
                              aria-label="Omhoog"
                              disabled={index === 0 || moveRankMutation.isPending}
                            >
                              <ArrowUp size={16} />
                            </button>
                            <button
                              type="button"
                              className="organisatie-ranks-action-btn"
                              onClick={() => moveRankMutation.mutate({ id: rank.id, direction: 'down' })}
                              title="Omlaag"
                              aria-label="Omlaag"
                              disabled={index === ranks.length - 1 || moveRankMutation.isPending}
                            >
                              <ArrowDown size={16} />
                            </button>
                            <button
                              type="button"
                              className="organisatie-ranks-action-btn"
                              onClick={() => handleStartEditRank(rank)}
                              title="Bewerken"
                              aria-label="Bewerken"
                            >
                              <Pencil size={16} />
                            </button>
                            <button
                              type="button"
                              className="organisatie-ranks-action-btn organisatie-ranks-action-btn-danger"
                              onClick={() =>
                                confirm('Rang wissen?') && deleteRankMutation.mutate(rank.id)
                              }
                              title="Wissen"
                              aria-label="Wissen"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

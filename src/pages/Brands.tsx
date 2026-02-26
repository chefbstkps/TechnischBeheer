import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  BrandsService,
  parseAndValidateCsv,
  type CsvParseResult,
} from '../services/brandsService';
import type { Brand, Model } from '../types/database';
import './Brands.css';

const CSV_VOORBEELD = `merk,merkbeschrijving,model,modelbeschrijving
Toyota,Japanse autofabrikant,Corolla,Compacte sedan
Toyota,,Camry,Middenklasse sedan
Volkswagen,Duitse autofabrikant,Golf,Compacte hatchback
`;

export default function Brands() {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [expandedBrandIds, setExpandedBrandIds] = useState<Set<string>>(new Set());
  const [editingBrand, setEditingBrand] = useState<Brand | null>(null);
  const [editBrandName, setEditBrandName] = useState('');
  const [editBrandBeschrijving, setEditBrandBeschrijving] = useState('');
  const [editingModel, setEditingModel] = useState<Model | null>(null);
  const [editModelName, setEditModelName] = useState('');
  const [editModelBeschrijving, setEditModelBeschrijving] = useState('');
  const [addingBrand, setAddingBrand] = useState(false);
  const [newBrandName, setNewBrandName] = useState('');
  const [newBrandBeschrijving, setNewBrandBeschrijving] = useState('');
  const [addingModelForBrandId, setAddingModelForBrandId] = useState<string | null>(null);
  const [newModelName, setNewModelName] = useState('');
  const [newModelBeschrijving, setNewModelBeschrijving] = useState('');
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState<string | null>(null);
  const [csvParseResult, setCsvParseResult] = useState<CsvParseResult | null>(null);
  const [csvRawContent, setCsvRawContent] = useState<string>('');

  const { data: brands = [], isLoading: brandsLoading } = useQuery({
    queryKey: ['brands'],
    queryFn: () => BrandsService.listBrands(),
  });

  const { data: models = [] } = useQuery({
    queryKey: ['models'],
    queryFn: () => BrandsService.listModels(),
  });

  const modelsByBrand = models.reduce<Record<string, Model[]>>((acc, m) => {
    if (!acc[m.brand_id]) acc[m.brand_id] = [];
    acc[m.brand_id].push(m);
    return acc;
  }, {});
  for (const id of Object.keys(modelsByBrand)) {
    modelsByBrand[id].sort((a, b) => a.name.localeCompare(b.name));
  }

  const toggleExpand = (id: string) => {
    setExpandedBrandIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const createBrandMutation = useMutation({
    mutationFn: ({ name, beschrijving }: { name: string; beschrijving?: string }) =>
      BrandsService.createBrand(name, beschrijving || null),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['brands'] });
      setAddingBrand(false);
      setNewBrandName('');
      setNewBrandBeschrijving('');
    },
  });

  const updateBrandMutation = useMutation({
    mutationFn: ({
      id,
      name,
      beschrijving,
    }: {
      id: string;
      name: string;
      beschrijving?: string | null;
    }) => BrandsService.updateBrand(id, name, beschrijving ?? null),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['brands'] });
      setEditingBrand(null);
    },
  });

  const deleteBrandMutation = useMutation({
    mutationFn: (id: string) => BrandsService.deleteBrand(id),
    onSuccess: (_data, deletedId) => {
      queryClient.invalidateQueries({ queryKey: ['brands'] });
      queryClient.invalidateQueries({ queryKey: ['models'] });
      setExpandedBrandIds((prev) => {
        const next = new Set(prev);
        next.delete(deletedId);
        return next;
      });
    },
  });

  const createModelMutation = useMutation({
    mutationFn: ({
      brandId,
      name,
      beschrijving,
    }: {
      brandId: string;
      name: string;
      beschrijving?: string;
    }) => BrandsService.createModel(brandId, name, beschrijving || null),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['models'] });
      setAddingModelForBrandId(null);
      setNewModelName('');
      setNewModelBeschrijving('');
    },
  });

  const updateModelMutation = useMutation({
    mutationFn: ({
      id,
      name,
      beschrijving,
    }: {
      id: string;
      name: string;
      beschrijving?: string | null;
    }) => BrandsService.updateModel(id, name, beschrijving ?? null),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['models'] });
      setEditingModel(null);
    },
  });

  const deleteModelMutation = useMutation({
    mutationFn: (id: string) => BrandsService.deleteModel(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['models'] });
    },
  });

  const importCsvMutation = useMutation({
    mutationFn: (csvContent: string) => BrandsService.importFromCsv(csvContent),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['brands'] });
      queryClient.invalidateQueries({ queryKey: ['models'] });
      setImportError(null);
      setCsvParseResult(null);
      setCsvRawContent('');
      setImportSuccess(
        `Import voltooid: ${result.brands} merk(merken) en ${result.models} model(modellen) toegevoegd.`
      );
      fileInputRef.current?.form?.reset();
    },
    onError: (err: Error) => {
      setImportError(err.message);
      setImportSuccess(null);
    },
  });

  const handleStartEditBrand = (b: Brand) => {
    setEditingBrand(b);
    setEditBrandName(b.name);
    setEditBrandBeschrijving(b.beschrijving ?? '');
  };

  const handleStartEditModel = (m: Model) => {
    setEditingModel(m);
    setEditModelName(m.name);
    setEditModelBeschrijving(m.beschrijving ?? '');
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
    a.download = 'merken_voorbeeld.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="brands">
      <div className="brands-header">
        <div>
          <h1>Merken</h1>
          <p className="brands-desc">
            Beheer automerken en modellen. Modellen vallen onder een merk.
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
              <h2>Merken importeren</h2>
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
                    Upload een CSV-bestand met kolommen <strong>merk</strong> en{' '}
                    <strong>model</strong>. Optioneel: <strong>merkbeschrijving</strong> en{' '}
                    <strong>modelbeschrijving</strong>.
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
                <p className="import-message import-pending">Bezig met importeren...</p>
              ) : (
                <>
                  <h3 className="import-preview-title">Preview – eerste 7 records</h3>
                  <p className="modal-hint">
                    Controleer de gegevens en kies Accepteren om te importeren of Afwijzen om te
                    annuleren.
                  </p>
                  <div className="import-preview-table-wrap">
                    <table className="import-preview-table">
                      <thead>
                        <tr>
                          <th>Merk</th>
                          <th>Merkbeschrijving</th>
                          <th>Model</th>
                          <th>Modelbeschrijving</th>
                        </tr>
                      </thead>
                      <tbody>
                        {csvParseResult.previewRows.map((row, idx) => (
                          <tr key={idx}>
                            <td>{row.merk || '—'}</td>
                            <td>{row.merkbeschrijving || '—'}</td>
                            <td>{row.model || '—'}</td>
                            <td>{row.modelbeschrijving || '—'}</td>
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

      <div className="brands-tree-section">
        <div className="brands-tree-toolbar">
          <button
            type="button"
            className="btn-add-brand"
            onClick={() => setAddingBrand(true)}
          >
            + Merk toevoegen
          </button>
        </div>

        {addingBrand && (
          <div className="brands-tree-item brands-tree-item-add">
            <div className="brands-edit-form">
              <input
                placeholder="Merk (bijv. Toyota)"
                value={newBrandName}
                onChange={(e) => setNewBrandName(e.target.value)}
                autoFocus
              />
              <input
                placeholder="Merkbeschrijving (optioneel)"
                value={newBrandBeschrijving}
                onChange={(e) => setNewBrandBeschrijving(e.target.value)}
              />
              <div className="brands-edit-actions">
                <button
                  onClick={() =>
                    newBrandName.trim() &&
                    createBrandMutation.mutate({
                      name: newBrandName.trim(),
                      beschrijving: newBrandBeschrijving.trim() || undefined,
                    })
                  }
                  disabled={!newBrandName.trim()}
                >
                  Opslaan
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    setAddingBrand(false);
                    setNewBrandName('');
                    setNewBrandBeschrijving('');
                  }}
                >
                  Annuleren
                </button>
              </div>
            </div>
          </div>
        )}

        {brandsLoading ? (
          <p className="brands-loading">Laden...</p>
        ) : (
          <ul className="brands-tree">
            {brands.map((b) => (
              <li key={b.id} className="brands-tree-node">
                <div className="brands-tree-item brands-tree-item-brand">
                  <button
                    type="button"
                    className="brands-tree-expand"
                    onClick={() => toggleExpand(b.id)}
                    aria-label={expandedBrandIds.has(b.id) ? 'Inklappen' : 'Uitklappen'}
                  >
                    {expandedBrandIds.has(b.id) ? '▼' : '►'}
                  </button>
                  <div className="brands-tree-content">
                    {editingBrand?.id === b.id ? (
                      <div className="brands-edit-form">
                        <input
                          placeholder="Merk"
                          value={editBrandName}
                          onChange={(e) => setEditBrandName(e.target.value)}
                          autoFocus
                        />
                        <input
                          placeholder="Merkbeschrijving"
                          value={editBrandBeschrijving}
                          onChange={(e) => setEditBrandBeschrijving(e.target.value)}
                        />
                        <div className="brands-edit-actions">
                          <button
                            onClick={() =>
                              updateBrandMutation.mutate({
                                id: b.id,
                                name: editBrandName.trim(),
                                beschrijving: editBrandBeschrijving.trim() || null,
                              })
                            }
                            disabled={!editBrandName.trim()}
                          >
                            Opslaan
                          </button>
                          <button
                            type="button"
                            className="btn-secondary"
                            onClick={() => setEditingBrand(null)}
                          >
                            Annuleren
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="brands-tree-label">
                          <span className="brands-tree-name">{b.name}</span>
                          {b.beschrijving && (
                            <span className="brands-tree-desc">{b.beschrijving}</span>
                          )}
                        </div>
                        <div className="brands-tree-actions">
                          <button
                            type="button"
                            className="btn-icon btn-add"
                            onClick={() => {
                              setAddingModelForBrandId(b.id);
                              setExpandedBrandIds((prev) => new Set(prev).add(b.id));
                            }}
                            title="Model toevoegen"
                          >
                            +
                          </button>
                          <button
                            type="button"
                            className="btn-icon"
                            onClick={() => handleStartEditBrand(b)}
                            title="Bewerken"
                          >
                            ✎
                          </button>
                          <button
                            type="button"
                            className="btn-icon btn-danger"
                            onClick={() =>
                              confirm('Merk verwijderen? Alle modellen worden ook verwijderd.') &&
                              deleteBrandMutation.mutate(b.id)
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

                {expandedBrandIds.has(b.id) && (
                  <ul className="brands-tree-children">
                    {addingModelForBrandId === b.id && (
                      <li className="brands-tree-item brands-tree-item-add brands-tree-item-child">
                        <div className="brands-edit-form">
                          <input
                            placeholder="Model (bijv. Corolla)"
                            value={newModelName}
                            onChange={(e) => setNewModelName(e.target.value)}
                            autoFocus
                          />
                          <input
                            placeholder="Modelbeschrijving (optioneel)"
                            value={newModelBeschrijving}
                            onChange={(e) => setNewModelBeschrijving(e.target.value)}
                          />
                          <div className="brands-edit-actions">
                            <button
                              onClick={() =>
                                newModelName.trim() &&
                                createModelMutation.mutate({
                                  brandId: b.id,
                                  name: newModelName.trim(),
                                  beschrijving: newModelBeschrijving.trim() || undefined,
                                })
                              }
                              disabled={!newModelName.trim()}
                            >
                              Opslaan
                            </button>
                            <button
                              type="button"
                              className="btn-secondary"
                              onClick={() => {
                                setAddingModelForBrandId(null);
                                setNewModelName('');
                                setNewModelBeschrijving('');
                              }}
                            >
                              Annuleren
                            </button>
                          </div>
                        </div>
                      </li>
                    )}
                    {(modelsByBrand[b.id] ?? []).map((m) => (
                      <li key={m.id} className="brands-tree-item brands-tree-item-child">
                        <div className="brands-tree-content">
                          {editingModel?.id === m.id ? (
                            <div className="brands-edit-form">
                              <input
                                placeholder="Model"
                                value={editModelName}
                                onChange={(e) => setEditModelName(e.target.value)}
                                autoFocus
                              />
                              <input
                                placeholder="Modelbeschrijving"
                                value={editModelBeschrijving}
                                onChange={(e) => setEditModelBeschrijving(e.target.value)}
                              />
                              <div className="brands-edit-actions">
                                <button
                                  onClick={() =>
                                    updateModelMutation.mutate({
                                      id: m.id,
                                      name: editModelName.trim(),
                                      beschrijving: editModelBeschrijving.trim() || null,
                                    })
                                  }
                                  disabled={!editModelName.trim()}
                                >
                                  Opslaan
                                </button>
                                <button
                                  type="button"
                                  className="btn-secondary"
                                  onClick={() => setEditingModel(null)}
                                >
                                  Annuleren
                                </button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <div className="brands-tree-label">
                                <span className="brands-tree-name">{m.name}</span>
                                {m.beschrijving && (
                                  <span className="brands-tree-desc">{m.beschrijving}</span>
                                )}
                              </div>
                              <div className="brands-tree-actions">
                                <button
                                  type="button"
                                  className="btn-icon"
                                  onClick={() => handleStartEditModel(m)}
                                  title="Bewerken"
                                >
                                  ✎
                                </button>
                                <button
                                  type="button"
                                  className="btn-icon btn-danger"
                                  onClick={() =>
                                    confirm('Model verwijderen?') &&
                                    deleteModelMutation.mutate(m.id)
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
    </div>
  );
}

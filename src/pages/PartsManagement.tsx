import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PartsService } from '../services/partsService';
import type { Part } from '../types/database';
import './PartsManagement.css';

export default function PartsManagement() {
  const queryClient = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newBeschrijving, setNewBeschrijving] = useState('');
  const [editingPart, setEditingPart] = useState<Part | null>(null);
  const [editName, setEditName] = useState('');
  const [editBeschrijving, setEditBeschrijving] = useState('');

  const { data: parts = [], isLoading } = useQuery({
    queryKey: ['parts'],
    queryFn: () => PartsService.list(),
  });

  const createMutation = useMutation({
    mutationFn: ({ name, beschrijving }: { name: string; beschrijving?: string | null }) =>
      PartsService.create(name, beschrijving ?? null),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parts'] });
      setAdding(false);
      setNewName('');
      setNewBeschrijving('');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      name,
      beschrijving,
    }: {
      id: string;
      name: string;
      beschrijving?: string | null;
    }) => PartsService.update(id, name, beschrijving ?? null),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parts'] });
      setEditingPart(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => PartsService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parts'] });
    },
  });

  const startEdit = (p: Part) => {
    setEditingPart(p);
    setEditName(p.name);
    setEditBeschrijving(p.beschrijving ?? '');
  };

  const cancelEdit = () => {
    setEditingPart(null);
  };

  return (
    <div className="parts-management">
      <div className="parts-management-header">
        <div>
          <h1>Onderdelenbeheer</h1>
          <p className="parts-management-desc">
            Auto-onderdelen toevoegen met optionele beschrijving (bijv. Stuurbal, Links).
          </p>
        </div>
        {!adding && (
          <button
            type="button"
            className="parts-management-btn-add"
            onClick={() => setAdding(true)}
          >
            + Onderdeel toevoegen
          </button>
        )}
      </div>

      {adding && (
        <div className="parts-management-item parts-management-item-add">
          <div className="parts-management-edit-form">
            <input
              placeholder="Naam (bijv. Schokkendemper)"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              autoFocus
            />
            <input
              placeholder="Beschrijving (optioneel, bijv. Links)"
              value={newBeschrijving}
              onChange={(e) => setNewBeschrijving(e.target.value)}
            />
            <div className="parts-management-edit-actions">
              <button
                type="button"
                onClick={() =>
                  newName.trim() &&
                  createMutation.mutate({
                    name: newName.trim(),
                    beschrijving: newBeschrijving.trim() || null,
                  })
                }
                disabled={!newName.trim()}
              >
                Opslaan
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  setAdding(false);
                  setNewName('');
                  setNewBeschrijving('');
                }}
              >
                Annuleren
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="parts-management-list-section">
        {isLoading ? (
          <p className="parts-management-loading">Laden...</p>
        ) : (
          <ul className="parts-management-list">
            {parts.map((p) => (
              <li key={p.id} className="parts-management-item">
                {editingPart?.id === p.id ? (
                  <div className="parts-management-edit-form">
                    <input
                      placeholder="Naam"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      autoFocus
                    />
                    <input
                      placeholder="Beschrijving (optioneel)"
                      value={editBeschrijving}
                      onChange={(e) => setEditBeschrijving(e.target.value)}
                    />
                    <div className="parts-management-edit-actions">
                      <button
                        type="button"
                        onClick={() =>
                          updateMutation.mutate({
                            id: p.id,
                            name: editName.trim(),
                            beschrijving: editBeschrijving.trim() || null,
                          })
                        }
                        disabled={!editName.trim()}
                      >
                        Opslaan
                      </button>
                      <button type="button" className="btn-secondary" onClick={cancelEdit}>
                        Annuleren
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="parts-management-label">
                      <span className="parts-management-name">{p.name}</span>
                      {p.beschrijving && (
                        <span className="parts-management-desc">{p.beschrijving}</span>
                      )}
                    </div>
                    <div className="parts-management-actions">
                      <button
                        type="button"
                        className="parts-management-btn-icon"
                        onClick={() => startEdit(p)}
                        title="Bewerken"
                      >
                        ✎
                      </button>
                      <button
                        type="button"
                        className="parts-management-btn-icon parts-management-btn-danger"
                        onClick={() =>
                          confirm('Onderdeel verwijderen?') && deleteMutation.mutate(p.id)
                        }
                        title="Verwijderen"
                      >
                        🗑
                      </button>
                    </div>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

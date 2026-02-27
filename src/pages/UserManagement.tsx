import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import * as AuthService from '../services/authService';
import type { AppUser, CreateUserData, UpdateUserData } from '../types/auth';
import './UserManagement.css';

interface UserFormState {
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  password: string;
  role: AppUser['role'];
  telefoonnummer: string;
  rang: string;
  organisatie: string;
  structuur: string;
  afdeling: string;
}

const EMPTY_NEW_USER: UserFormState = {
  username: '',
  email: '',
  first_name: '',
  last_name: '',
  password: '',
  role: 'user',
  telefoonnummer: '',
  rang: '',
  organisatie: '',
  structuur: '',
  afdeling: '',
};

export default function UserManagement() {
  const { isAdmin } = useAuth();
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const [newUser, setNewUser] = useState<UserFormState>(EMPTY_NEW_USER);
  const [creating, setCreating] = useState(false);

  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editUser, setEditUser] = useState<Omit<UserFormState, 'password' | 'username'>>({
    email: '',
    first_name: '',
    last_name: '',
    role: 'user',
    telefoonnummer: '',
    rang: '',
    organisatie: '',
    structuur: '',
    afdeling: '',
  });
  const [editActive, setEditActive] = useState(true);
  const [savingEdit, setSavingEdit] = useState(false);

  const [passwordResetValue, setPasswordResetValue] = useState('');
  const [resetTargetId, setResetTargetId] = useState<string | null>(null);
  const [resetBusy, setResetBusy] = useState(false);

  async function loadUsers() {
    setLoading(true);
    setError('');
    try {
      const allUsers = await AuthService.getAllUsers();
      setUsers(allUsers);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gebruikers laden mislukt.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadUsers();
  }, []);

  const sortedUsers = useMemo(() => [...users].sort((a, b) => a.username.localeCompare(b.username)), [users]);

  if (!isAdmin()) {
    return (
      <div className="user-management-page">
        <h1>User Management</h1>
        <p className="um-error">Geen toegang.</p>
      </div>
    );
  }

  function startEdit(user: AppUser) {
    setEditingUserId(user.id);
    setEditUser({
      email: user.email,
      first_name: user.first_name,
      last_name: user.last_name,
      role: user.role,
      telefoonnummer: user.telefoonnummer ?? '',
      rang: user.rang ?? '',
      organisatie: user.organisatie ?? '',
      structuur: user.structuur ?? '',
      afdeling: user.afdeling ?? '',
    });
    setEditActive(user.is_active);
  }

  function cancelEdit() {
    setEditingUserId(null);
  }

  async function handleCreateUser(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setMessage('');

    if (!newUser.username.trim() || !newUser.email.trim() || !newUser.first_name.trim() || !newUser.last_name.trim()) {
      setError('Vul alle verplichte velden in om een gebruiker aan te maken.');
      return;
    }
    if (newUser.password.length < 6) {
      setError('Wachtwoord moet minimaal 6 tekens bevatten.');
      return;
    }

    setCreating(true);
    try {
      const payload: CreateUserData = {
        username: newUser.username.trim(),
        email: newUser.email.trim(),
        first_name: newUser.first_name.trim(),
        last_name: newUser.last_name.trim(),
        password: newUser.password,
        role: newUser.role,
        telefoonnummer: newUser.telefoonnummer,
        rang: newUser.rang,
        organisatie: newUser.organisatie,
        structuur: newUser.structuur,
        afdeling: newUser.afdeling,
      };
      await AuthService.createUser(payload);
      setNewUser(EMPTY_NEW_USER);
      setMessage('Gebruiker aangemaakt.');
      await loadUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gebruiker aanmaken mislukt.');
    } finally {
      setCreating(false);
    }
  }

  async function handleSaveEdit(userId: string) {
    setError('');
    setMessage('');
    setSavingEdit(true);
    try {
      const payload: UpdateUserData = {
        email: editUser.email,
        first_name: editUser.first_name,
        last_name: editUser.last_name,
        role: editUser.role,
        is_active: editActive,
        telefoonnummer: editUser.telefoonnummer,
        rang: editUser.rang,
        organisatie: editUser.organisatie,
        structuur: editUser.structuur,
        afdeling: editUser.afdeling,
      };
      await AuthService.updateUser(userId, payload);
      setEditingUserId(null);
      setMessage('Gebruiker bijgewerkt.');
      await loadUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gebruiker bijwerken mislukt.');
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleDelete(userId: string) {
    const confirmed = window.confirm('Weet je zeker dat je deze gebruiker wilt verwijderen?');
    if (!confirmed) return;

    setError('');
    setMessage('');
    try {
      await AuthService.deleteUser(userId);
      setMessage('Gebruiker verwijderd.');
      await loadUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gebruiker verwijderen mislukt.');
    }
  }

  async function handleResetPassword(userId: string) {
    if (!passwordResetValue || passwordResetValue.length < 6) {
      setError('Vul een nieuw wachtwoord van minimaal 6 tekens in.');
      return;
    }

    setResetBusy(true);
    setError('');
    setMessage('');
    try {
      await AuthService.resetPassword({ user_id: userId, new_password: passwordResetValue });
      setResetTargetId(null);
      setPasswordResetValue('');
      setMessage('Wachtwoord is gereset.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reset wachtwoord mislukt.');
    } finally {
      setResetBusy(false);
    }
  }

  return (
    <div className="user-management-page">
      <div className="um-header">
        <h1>User Management</h1>
        <button type="button" className="btn-secondary" onClick={() => void loadUsers()} disabled={loading}>
          Vernieuwen
        </button>
      </div>

      {error ? <div className="um-error">{error}</div> : null}
      {message ? <div className="um-success">{message}</div> : null}

      <section className="um-card">
        <h2>Nieuwe gebruiker</h2>
        <form className="um-grid" onSubmit={handleCreateUser}>
          <label>
            Gebruikersnaam *
            <input value={newUser.username} onChange={(e) => setNewUser((p) => ({ ...p, username: e.target.value }))} />
          </label>
          <label>
            E-mail *
            <input type="email" value={newUser.email} onChange={(e) => setNewUser((p) => ({ ...p, email: e.target.value }))} />
          </label>
          <label>
            Voornaam *
            <input value={newUser.first_name} onChange={(e) => setNewUser((p) => ({ ...p, first_name: e.target.value }))} />
          </label>
          <label>
            Achternaam *
            <input value={newUser.last_name} onChange={(e) => setNewUser((p) => ({ ...p, last_name: e.target.value }))} />
          </label>
          <label>
            Wachtwoord *
            <input
              type="password"
              minLength={6}
              value={newUser.password}
              onChange={(e) => setNewUser((p) => ({ ...p, password: e.target.value }))}
            />
          </label>
          <label>
            Rol
            <select value={newUser.role} onChange={(e) => setNewUser((p) => ({ ...p, role: e.target.value as AppUser['role'] }))}>
              <option value="user">user</option>
              <option value="super_user">super_user</option>
              <option value="admin">admin</option>
            </select>
          </label>
          <label>
            Telefoonnummer
            <input value={newUser.telefoonnummer} onChange={(e) => setNewUser((p) => ({ ...p, telefoonnummer: e.target.value }))} />
          </label>
          <label>
            Rang
            <input value={newUser.rang} onChange={(e) => setNewUser((p) => ({ ...p, rang: e.target.value }))} />
          </label>
          <label>
            Organisatie
            <input value={newUser.organisatie} onChange={(e) => setNewUser((p) => ({ ...p, organisatie: e.target.value }))} />
          </label>
          <label>
            Structuur
            <input value={newUser.structuur} onChange={(e) => setNewUser((p) => ({ ...p, structuur: e.target.value }))} />
          </label>
          <label>
            Afdeling
            <input value={newUser.afdeling} onChange={(e) => setNewUser((p) => ({ ...p, afdeling: e.target.value }))} />
          </label>
          <div className="um-actions">
            <button type="submit" className="btn-primary" disabled={creating}>
              {creating ? 'Aanmaken...' : 'Gebruiker aanmaken'}
            </button>
          </div>
        </form>
      </section>

      <section className="um-card">
        <h2>Gebruikers</h2>
        {loading ? (
          <p>Laden...</p>
        ) : (
          <div className="um-table-wrap">
            <table className="um-table">
              <thead>
                <tr>
                  <th>Gebruikersnaam</th>
                  <th>Naam</th>
                  <th>Rol</th>
                  <th>Status</th>
                  <th>Laatste login</th>
                  <th>Acties</th>
                </tr>
              </thead>
              <tbody>
                {sortedUsers.map((user) => {
                  const isEditing = editingUserId === user.id;
                  return (
                    <tr key={user.id}>
                      <td>{user.username}</td>
                      <td>{`${user.first_name} ${user.last_name}`.trim()}</td>
                      <td>{user.role}</td>
                      <td>{user.is_active ? 'Actief' : 'Inactief'}</td>
                      <td>{user.last_login ? new Date(user.last_login).toLocaleString('nl-NL') : '-'}</td>
                      <td>
                        <div className="um-row-actions">
                          <Link className="btn-small" to={`/user-management/${user.id}`}>
                            Details
                          </Link>
                          {!isEditing ? (
                            <button type="button" className="btn-secondary btn-small" onClick={() => startEdit(user)}>
                              Bewerken
                            </button>
                          ) : (
                            <>
                              <button type="button" className="btn-primary btn-small" onClick={() => void handleSaveEdit(user.id)} disabled={savingEdit}>
                                Opslaan
                              </button>
                              <button type="button" className="btn-secondary btn-small" onClick={cancelEdit}>
                                Annuleren
                              </button>
                            </>
                          )}
                          <button type="button" className="btn-danger btn-small" onClick={() => void handleDelete(user.id)}>
                            Verwijderen
                          </button>
                        </div>
                        {isEditing ? (
                          <div className="um-edit-grid">
                            <label>
                              Voornaam
                              <input
                                value={editUser.first_name}
                                onChange={(e) => setEditUser((p) => ({ ...p, first_name: e.target.value }))}
                              />
                            </label>
                            <label>
                              Achternaam
                              <input
                                value={editUser.last_name}
                                onChange={(e) => setEditUser((p) => ({ ...p, last_name: e.target.value }))}
                              />
                            </label>
                            <label>
                              E-mail
                              <input value={editUser.email} onChange={(e) => setEditUser((p) => ({ ...p, email: e.target.value }))} />
                            </label>
                            <label>
                              Rol
                              <select
                                value={editUser.role}
                                onChange={(e) => setEditUser((p) => ({ ...p, role: e.target.value as AppUser['role'] }))}
                              >
                                <option value="user">user</option>
                                <option value="super_user">super_user</option>
                                <option value="admin">admin</option>
                              </select>
                            </label>
                            <label className="um-checkbox">
                              <input type="checkbox" checked={editActive} onChange={(e) => setEditActive(e.target.checked)} />
                              Actief
                            </label>
                            <label>
                              Telefoonnummer
                              <input
                                value={editUser.telefoonnummer}
                                onChange={(e) => setEditUser((p) => ({ ...p, telefoonnummer: e.target.value }))}
                              />
                            </label>
                            <label>
                              Rang
                              <input value={editUser.rang} onChange={(e) => setEditUser((p) => ({ ...p, rang: e.target.value }))} />
                            </label>
                            <label>
                              Organisatie
                              <input
                                value={editUser.organisatie}
                                onChange={(e) => setEditUser((p) => ({ ...p, organisatie: e.target.value }))}
                              />
                            </label>
                            <label>
                              Structuur
                              <input
                                value={editUser.structuur}
                                onChange={(e) => setEditUser((p) => ({ ...p, structuur: e.target.value }))}
                              />
                            </label>
                            <label>
                              Afdeling
                              <input value={editUser.afdeling} onChange={(e) => setEditUser((p) => ({ ...p, afdeling: e.target.value }))} />
                            </label>
                          </div>
                        ) : null}

                        {resetTargetId === user.id ? (
                          <div className="um-reset-box">
                            <input
                              type="password"
                              placeholder="Nieuw wachtwoord (min. 6)"
                              value={passwordResetValue}
                              onChange={(e) => setPasswordResetValue(e.target.value)}
                            />
                            <button
                              type="button"
                              className="btn-primary btn-small"
                              disabled={resetBusy}
                              onClick={() => void handleResetPassword(user.id)}
                            >
                              {resetBusy ? 'Bezig...' : 'Reset opslaan'}
                            </button>
                            <button
                              type="button"
                              className="btn-secondary btn-small"
                              onClick={() => {
                                setResetTargetId(null);
                                setPasswordResetValue('');
                              }}
                            >
                              Annuleren
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            className="btn-secondary btn-small"
                            onClick={() => {
                              setResetTargetId(user.id);
                              setPasswordResetValue('');
                            }}
                          >
                            Wachtwoord resetten
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

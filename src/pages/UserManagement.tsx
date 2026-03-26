import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Check, KeyRound, Trash2, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import * as AuthService from '../services/authService';
import { OrganisationService } from '../services/organisationService';
import type { AppUser, CreateUserData } from '../types/auth';
import { getRankOptions } from '../utils/ranks';
import './UserManagement.css';

const DEFAULT_ORGANISATIE = 'Politie';
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;

type AsyncFieldStatus = 'idle' | 'checking' | 'valid' | 'invalid';

interface AsyncFieldState {
  status: AsyncFieldStatus;
  message: string;
}

interface NewUserFormState {
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  password: string;
  confirm_password: string;
  role: AppUser['role'];
  telefoonnummer: string;
  rang: string;
  organisatie: string;
  structure_id: string;
  department_id: string;
  is_medewerker: boolean;
}

const EMPTY_NEW_USER: NewUserFormState = {
  username: '',
  email: '',
  first_name: '',
  last_name: '',
  password: '',
  confirm_password: '',
  role: 'user',
  telefoonnummer: '',
  rang: '',
  organisatie: DEFAULT_ORGANISATIE,
  structure_id: '',
  department_id: '',
  is_medewerker: false,
};

const EMPTY_FIELD_STATE: AsyncFieldState = {
  status: 'idle',
  message: '',
};

function getEmailValidationMessage(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';
  if (!EMAIL_REGEX.test(trimmed)) {
    return 'Voer een geldig e-mailadres in.';
  }
  return '';
}

function getPasswordValidationMessage(value: string): string {
  if (!value) return '';
  if (!PASSWORD_REGEX.test(value)) {
    return 'Wachtwoord moet minimaal 8 tekens hebben en minstens 1 kleine letter, 1 hoofdletter en 1 cijfer bevatten.';
  }
  return '';
}

function getConfirmPasswordValidationMessage(password: string, confirmPassword: string): string {
  if (!confirmPassword) return '';
  if (password !== confirmPassword) {
    return 'Bevestigd wachtwoord komt niet overeen.';
  }
  return '';
}

function getDefaultResetPassword(username: string): string {
  return `${username.trim()}@123`;
}

function getFieldHintClass(status: AsyncFieldStatus): string {
  if (status === 'valid') return 'um-field-hint um-field-hint-success';
  if (status === 'invalid') return 'um-field-hint um-field-hint-error';
  return 'um-field-hint um-field-hint-muted';
}

export default function UserManagement() {
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const [showNewUserForm, setShowNewUserForm] = useState(false);
  const [newUser, setNewUser] = useState<NewUserFormState>(EMPTY_NEW_USER);
  const [creating, setCreating] = useState(false);
  const [usernameAvailability, setUsernameAvailability] = useState<AsyncFieldState>(EMPTY_FIELD_STATE);
  const [emailAvailability, setEmailAvailability] = useState<AsyncFieldState>(EMPTY_FIELD_STATE);

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

  const { data: ranks = [] } = useQuery({
    queryKey: ['ranks'],
    queryFn: () => OrganisationService.listRanks(),
  });
  const { data: structures = [] } = useQuery({
    queryKey: ['structures'],
    queryFn: () => OrganisationService.listStructures(),
  });
  const { data: departments = [] } = useQuery({
    queryKey: ['departments', newUser.structure_id],
    queryFn: () => OrganisationService.listDepartments(newUser.structure_id),
    enabled: !!newUser.structure_id,
  });

  const sortedUsers = useMemo(() => [...users].sort((a, b) => a.username.localeCompare(b.username)), [users]);
  const pendingUsers = useMemo(
    () =>
      users
        .filter((user) => !user.is_active)
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
    [users]
  );
  const pendingApprovalCount = pendingUsers.length;
  const newUserRankOptions = useMemo(() => getRankOptions(ranks), [ranks]);
  const selectedStructure = useMemo(
    () => structures.find((structure) => structure.id === newUser.structure_id) ?? null,
    [newUser.structure_id, structures]
  );
  const selectedDepartment = useMemo(
    () => departments.find((department) => department.id === newUser.department_id) ?? null,
    [departments, newUser.department_id]
  );
  const emailValidationMessage = useMemo(() => getEmailValidationMessage(newUser.email), [newUser.email]);
  const passwordValidationMessage = useMemo(
    () => getPasswordValidationMessage(newUser.password),
    [newUser.password]
  );
  const confirmPasswordValidationMessage = useMemo(
    () => getConfirmPasswordValidationMessage(newUser.password, newUser.confirm_password),
    [newUser.confirm_password, newUser.password]
  );

  if (!isAdmin()) {
    return (
      <div className="user-management-page">
        <h1>User Management</h1>
        <p className="um-error">Geen toegang.</p>
      </div>
    );
  }

  function updateNewUserField<K extends keyof NewUserFormState>(key: K, value: NewUserFormState[K]) {
    setError('');
    setMessage('');
    setNewUser((prev) => ({
      ...prev,
      [key]: value,
      ...(key === 'structure_id' ? { department_id: '' } : {}),
    }));
  }

  function openNewUserForm() {
    setShowNewUserForm(true);
    setError('');
    setMessage('');
  }

  function closeNewUserForm() {
    setShowNewUserForm(false);
    setNewUser(EMPTY_NEW_USER);
    setUsernameAvailability(EMPTY_FIELD_STATE);
    setEmailAvailability(EMPTY_FIELD_STATE);
    setError('');
    setMessage('');
  }

  useEffect(() => {
    if (!showNewUserForm) {
      setUsernameAvailability(EMPTY_FIELD_STATE);
      return;
    }

    const username = newUser.username.trim();
    if (!username) {
      setUsernameAvailability(EMPTY_FIELD_STATE);
      return;
    }

    let cancelled = false;
    const timeoutId = window.setTimeout(async () => {
      setUsernameAvailability({
        status: 'checking',
        message: 'Gebruikersnaam controleren...',
      });
      try {
        const available = await AuthService.isUsernameAvailable(username);
        if (cancelled) return;
        setUsernameAvailability(
          available
            ? { status: 'valid', message: 'Gebruikersnaam is beschikbaar.' }
            : { status: 'invalid', message: 'Deze gebruikersnaam bestaat al.' }
        );
      } catch {
        if (cancelled) return;
        setUsernameAvailability({
          status: 'invalid',
          message: 'Controle van gebruikersnaam mislukt.',
        });
      }
    }, 400);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [newUser.username, showNewUserForm]);

  useEffect(() => {
    if (!showNewUserForm) {
      setEmailAvailability(EMPTY_FIELD_STATE);
      return;
    }

    const email = newUser.email.trim();
    if (!email) {
      setEmailAvailability(EMPTY_FIELD_STATE);
      return;
    }

    if (emailValidationMessage) {
      setEmailAvailability({
        status: 'invalid',
        message: emailValidationMessage,
      });
      return;
    }

    let cancelled = false;
    const timeoutId = window.setTimeout(async () => {
      setEmailAvailability({
        status: 'checking',
        message: 'E-mailadres controleren...',
      });
      try {
        const available = await AuthService.isEmailAvailable(email);
        if (cancelled) return;
        setEmailAvailability(
          available
            ? { status: 'valid', message: 'E-mailadres is beschikbaar.' }
            : { status: 'invalid', message: 'Dit e-mailadres bestaat al.' }
        );
      } catch {
        if (cancelled) return;
        setEmailAvailability({
          status: 'invalid',
          message: 'Controle van e-mailadres mislukt.',
        });
      }
    }, 400);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [emailValidationMessage, newUser.email, showNewUserForm]);

  async function handleCreateUser(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setMessage('');

    if (!newUser.username.trim() || !newUser.email.trim() || !newUser.first_name.trim() || !newUser.last_name.trim()) {
      setError('Vul alle verplichte velden in om een gebruiker aan te maken.');
      return;
    }
    if (emailValidationMessage) {
      setError(emailValidationMessage);
      return;
    }
    if (passwordValidationMessage) {
      setError(passwordValidationMessage);
      return;
    }
    if (confirmPasswordValidationMessage) {
      setError(confirmPasswordValidationMessage);
      return;
    }
    if (usernameAvailability.status === 'checking' || emailAvailability.status === 'checking') {
      setError('Wacht tot de validatie van gebruikersnaam en e-mailadres is afgerond.');
      return;
    }
    if (usernameAvailability.status === 'invalid') {
      setError(usernameAvailability.message);
      return;
    }
    if (emailAvailability.status === 'invalid') {
      setError(emailAvailability.message);
      return;
    }

    setCreating(true);
    try {
      const [usernameAvailable, emailAvailable] = await Promise.all([
        AuthService.isUsernameAvailable(newUser.username),
        AuthService.isEmailAvailable(newUser.email),
      ]);

      if (!usernameAvailable) {
        const nextMessage = 'Deze gebruikersnaam bestaat al.';
        setUsernameAvailability({ status: 'invalid', message: nextMessage });
        setError(nextMessage);
        return;
      }

      if (!emailAvailable) {
        const nextMessage = 'Dit e-mailadres bestaat al.';
        setEmailAvailability({ status: 'invalid', message: nextMessage });
        setError(nextMessage);
        return;
      }

      const payload: CreateUserData = {
        username: newUser.username.trim(),
        email: newUser.email.trim(),
        first_name: newUser.first_name.trim(),
        last_name: newUser.last_name.trim(),
        password: newUser.password,
        role: newUser.role,
        telefoonnummer: newUser.telefoonnummer,
        rang: newUser.rang,
        organisatie: DEFAULT_ORGANISATIE,
        structuur: selectedStructure?.name ?? '',
        afdeling: selectedDepartment?.name ?? '',
        is_medewerker: newUser.is_medewerker,
      };
      await AuthService.createUser(payload);
      closeNewUserForm();
      setMessage('Gebruiker aangemaakt.');
      await loadUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gebruiker aanmaken mislukt.');
    } finally {
      setCreating(false);
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

  async function handleApproveUser(userId: string) {
    setError('');
    setMessage('');
    try {
      await AuthService.updateUser(userId, { is_active: true });
      setMessage('Gebruiker is goedgekeurd.');
      await loadUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gebruiker goedkeuren mislukt.');
    }
  }

  async function handleRejectUser(userId: string) {
    const confirmed = window.confirm('Weet je zeker dat je deze gebruiker wilt afkeuren en verwijderen?');
    if (!confirmed) return;

    setError('');
    setMessage('');
    try {
      await AuthService.deleteUser(userId);
      setMessage('Gebruiker is afgekeurd en verwijderd.');
      await loadUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gebruiker afkeuren mislukt.');
    }
  }

  async function handleResetPassword(userId: string) {
    if (!passwordResetValue || passwordResetValue.length < 8) {
      setError('Vul een nieuw wachtwoord van minimaal 8 tekens in.');
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
      {pendingApprovalCount > 0 ? (
        <div className="um-pending-alert">
          {pendingApprovalCount} gebruiker{pendingApprovalCount === 1 ? '' : 's'} wachten op goedkeuring!
        </div>
      ) : null}

      <section className="um-card">
        <div className="um-section-header">
          <h2>Nieuwe gebruiker</h2>
          {!showNewUserForm ? (
            <button type="button" className="btn-primary" onClick={openNewUserForm}>
              Nieuwe gebruiker
            </button>
          ) : null}
        </div>

        {showNewUserForm ? (
          <form className="um-grid" onSubmit={handleCreateUser}>
            <label>
              Gebruikersnaam *
              <input
                value={newUser.username}
                onChange={(e) => updateNewUserField('username', e.target.value)}
                required
              />
              {usernameAvailability.message ? (
                <span className={getFieldHintClass(usernameAvailability.status)}>
                  {usernameAvailability.message}
                </span>
              ) : null}
            </label>
            <label>
              E-mail *
              <input
                type="email"
                value={newUser.email}
                onChange={(e) => updateNewUserField('email', e.target.value)}
                required
              />
              {emailAvailability.message ? (
                <span className={getFieldHintClass(emailAvailability.status)}>
                  {emailAvailability.message}
                </span>
              ) : null}
            </label>
            <label>
              Voornaam *
              <input
                value={newUser.first_name}
                onChange={(e) => updateNewUserField('first_name', e.target.value)}
                required
              />
            </label>
            <label>
              Achternaam *
              <input
                value={newUser.last_name}
                onChange={(e) => updateNewUserField('last_name', e.target.value)}
                required
              />
            </label>
            <label>
              Wachtwoord *
              <input
                type="password"
                value={newUser.password}
                onChange={(e) => updateNewUserField('password', e.target.value)}
                required
              />
              {passwordValidationMessage ? (
                <span className="um-field-hint um-field-hint-error">
                  {passwordValidationMessage}
                </span>
              ) : (
                <span className="um-field-hint um-field-hint-muted">
                  Minimaal 8 tekens, met minstens 1 kleine letter, 1 hoofdletter en 1 cijfer.
                </span>
              )}
            </label>
            <label>
              Bevestig wachtwoord *
              <input
                type="password"
                value={newUser.confirm_password}
                onChange={(e) => updateNewUserField('confirm_password', e.target.value)}
                required
              />
              {confirmPasswordValidationMessage ? (
                <span className="um-field-hint um-field-hint-error">
                  {confirmPasswordValidationMessage}
                </span>
              ) : null}
            </label>
            <label>
              Rol
              <select
                value={newUser.role}
                onChange={(e) => updateNewUserField('role', e.target.value as AppUser['role'])}
              >
                <option value="user">user</option>
                <option value="super_user">super_user</option>
                <option value="admin">admin</option>
              </select>
            </label>
            <label className="um-checkbox app-switch-field">
              <span>Medewerker</span>
              <span className="app-switch-control">
                <input
                  type="checkbox"
                  checked={newUser.is_medewerker}
                  onChange={(e) => updateNewUserField('is_medewerker', e.target.checked)}
                />
                <span className="app-switch-slider" aria-hidden="true" />
              </span>
            </label>
            <label>
              Telefoonnummer
              <input
                value={newUser.telefoonnummer}
                onChange={(e) => updateNewUserField('telefoonnummer', e.target.value)}
              />
            </label>
            <label>
              Rang
              <select value={newUser.rang} onChange={(e) => updateNewUserField('rang', e.target.value)}>
                <option value="">Selecteer rang</option>
                {newUserRankOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Organisatie
              <input value={newUser.organisatie} readOnly disabled />
            </label>
            <label>
              Structuur
              <select
                value={newUser.structure_id}
                onChange={(e) => updateNewUserField('structure_id', e.target.value)}
              >
                <option value="">Selecteer structuur</option>
                {structures.map((structure) => (
                  <option key={structure.id} value={structure.id}>
                    {structure.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Afdeling
              <select
                value={newUser.department_id}
                onChange={(e) => updateNewUserField('department_id', e.target.value)}
                disabled={!newUser.structure_id}
              >
                <option value="">
                  {newUser.structure_id ? 'Selecteer afdeling' : 'Kies eerst een structuur'}
                </option>
                {departments.map((department) => (
                  <option key={department.id} value={department.id}>
                    {department.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="um-actions">
              <button type="submit" className="btn-primary" disabled={creating}>
                {creating ? 'Aanmaken...' : 'Gebruiker aanmaken'}
              </button>
              <button type="button" className="btn-secondary" onClick={closeNewUserForm} disabled={creating}>
                Cancel
              </button>
            </div>
          </form>
        ) : null}
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
                  <th>Medewerker</th>
                  <th>Status</th>
                  <th>Laatste login</th>
                  <th>Acties</th>
                </tr>
              </thead>
              <tbody>
                {sortedUsers.map((user) => (
                  <tr
                    key={user.id}
                    className="um-row-clickable"
                    onClick={() => navigate(`/user-management/${user.id}`)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        navigate(`/user-management/${user.id}`);
                      }
                    }}
                    role="button"
                    tabIndex={0}
                  >
                    <td>{user.username}</td>
                    <td>{`${user.first_name} ${user.last_name}`.trim()}</td>
                    <td>{user.role}</td>
                    <td>{user.is_medewerker ? 'Ja' : 'Nee'}</td>
                    <td>{user.is_active ? 'Actief' : 'Inactief'}</td>
                    <td>{user.last_login ? new Date(user.last_login).toLocaleString('nl-NL') : '-'}</td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <div className="um-row-actions">
                        <button
                          type="button"
                          className="um-icon-btn um-icon-btn-delete"
                          onClick={() => void handleDelete(user.id)}
                          title="Verwijderen"
                          aria-label="Verwijderen"
                        >
                          <Trash2 size={16} />
                        </button>

                        {resetTargetId !== user.id ? (
                          <button
                            type="button"
                            className="um-icon-btn um-icon-btn-reset"
                            onClick={() => {
                              setResetTargetId(user.id);
                              setPasswordResetValue(getDefaultResetPassword(user.username));
                            }}
                            title="Wachtwoord resetten"
                            aria-label="Wachtwoord resetten"
                          >
                            <KeyRound size={16} />
                          </button>
                        ) : null}
                      </div>

                      {resetTargetId === user.id ? (
                        <div className="um-reset-box" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="password"
                            placeholder="Nieuw wachtwoord (min. 8)"
                            value={passwordResetValue}
                            onChange={(e) => setPasswordResetValue(e.target.value)}
                          />
                          <span className="um-reset-hint">
                            Standaard resetwachtwoord: <strong>{getDefaultResetPassword(user.username)}</strong>
                          </span>
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
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="um-card">
        <h2>Gebruikers wachten op goedkeuring</h2>
        {pendingUsers.length === 0 ? (
          <p className="um-empty">Er wachten geen gebruikers op goedkeuring.</p>
        ) : (
          <div className="um-table-wrap">
            <table className="um-table">
              <thead>
                <tr>
                  <th>Gebruikersnaam</th>
                  <th>Naam</th>
                  <th>E-mail</th>
                  <th>Rol</th>
                  <th>Status</th>
                  <th>Aangemaakt op</th>
                  <th>Acties</th>
                </tr>
              </thead>
              <tbody>
                {pendingUsers.map((pendingUser) => (
                  <tr
                    key={pendingUser.id}
                    className="um-row-clickable"
                    onClick={() => navigate(`/user-management/${pendingUser.id}`)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        navigate(`/user-management/${pendingUser.id}`);
                      }
                    }}
                    role="button"
                    tabIndex={0}
                  >
                    <td>{pendingUser.username}</td>
                    <td>{`${pendingUser.first_name} ${pendingUser.last_name}`.trim() || '-'}</td>
                    <td>{pendingUser.email}</td>
                    <td>{pendingUser.role}</td>
                    <td>Inactief</td>
                    <td>{new Date(pendingUser.created_at).toLocaleString('nl-NL')}</td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <div className="um-row-actions">
                        <button
                          type="button"
                          className="um-icon-btn um-icon-btn-approve"
                          onClick={() => void handleApproveUser(pendingUser.id)}
                          title="Goedkeuren"
                          aria-label="Goedkeuren"
                        >
                          <Check size={16} />
                        </button>
                        <button
                          type="button"
                          className="um-icon-btn um-icon-btn-reject"
                          onClick={() => void handleRejectUser(pendingUser.id)}
                          title="Afkeuren"
                          aria-label="Afkeuren"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

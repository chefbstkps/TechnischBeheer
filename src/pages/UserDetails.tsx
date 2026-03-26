import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import * as AuthService from '../services/authService';
import { OrganisationService } from '../services/organisationService';
import {
  USER_PAGE_KEYS,
  type AppUser,
  type SessionTimeoutMinutes,
  type SessionTimeoutType,
  type UpdateUserData,
  type UserPageVisibility,
} from '../types/auth';
import { getRankOptions } from '../utils/ranks';
import './UserDetails.css';

interface ProfileFormState {
  first_name: string;
  last_name: string;
  email: string;
  role: AppUser['role'];
  is_active: boolean;
  is_medewerker: boolean;
  allow_multiple_sessions: boolean;
  telefoonnummer: string;
  rang: string;
  organisatie: string;
  structure_id: string;
  department_id: string;
  structuur: string;
  afdeling: string;
}

export default function UserDetails() {
  const { id } = useParams<{ id: string }>();
  const { isAdmin } = useAuth();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<AppUser | null>(null);
  const [visibility, setVisibility] = useState<UserPageVisibility | null>(null);
  const [profileForm, setProfileForm] = useState<ProfileFormState | null>(null);
  const [timeoutMinutes, setTimeoutMinutes] = useState<SessionTimeoutMinutes>(null);
  const [timeoutType, setTimeoutType] = useState<SessionTimeoutType>('since_login');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const { data: ranks = [] } = useQuery({
    queryKey: ['ranks'],
    queryFn: () => OrganisationService.listRanks(),
  });
  const { data: structures = [] } = useQuery({
    queryKey: ['structures'],
    queryFn: () => OrganisationService.listStructures(),
  });
  const { data: departments = [] } = useQuery({
    queryKey: ['departments', profileForm?.structure_id ?? ''],
    queryFn: () => OrganisationService.listDepartments(profileForm?.structure_id ?? ''),
    enabled: !!profileForm?.structure_id,
  });

  async function loadData(userId: string) {
    setLoading(true);
    setError('');
    try {
      const [currentUser, currentVisibility] = await Promise.all([
        AuthService.getCurrentUser(userId),
        AuthService.getUserPageVisibility(userId),
      ]);
      if (!currentUser) {
        setError('Gebruiker niet gevonden.');
        setUser(null);
        return;
      }
      setUser(currentUser);
      setVisibility(currentVisibility);
      setProfileForm({
        first_name: currentUser.first_name,
        last_name: currentUser.last_name,
        email: currentUser.email,
        role: currentUser.role,
        is_active: currentUser.is_active,
        is_medewerker: currentUser.is_medewerker ?? false,
        allow_multiple_sessions: currentUser.allow_multiple_sessions ?? false,
        telefoonnummer: currentUser.telefoonnummer ?? '',
        rang: currentUser.rang ?? '',
        organisatie: currentUser.organisatie ?? '',
        structure_id: '',
        department_id: '',
        structuur: currentUser.structuur ?? '',
        afdeling: currentUser.afdeling ?? '',
      });
      setTimeoutMinutes(currentUser.session_timeout_minutes ?? null);
      setTimeoutType(currentUser.session_timeout_type ?? 'since_login');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gegevens laden mislukt.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!id) {
      setError('Geen gebruiker-ID opgegeven.');
      setLoading(false);
      return;
    }
    void loadData(id);
  }, [id]);

  const selectedStructure = useMemo(
    () =>
      profileForm
        ? structures.find((structure) => structure.id === profileForm.structure_id) ?? null
        : null,
    [profileForm, structures]
  );
  const selectedDepartment = useMemo(
    () =>
      profileForm
        ? departments.find((department) => department.id === profileForm.department_id) ?? null
        : null,
    [departments, profileForm]
  );

  useEffect(() => {
    if (!profileForm || profileForm.structure_id || !profileForm.structuur || structures.length === 0) return;
    const matchingStructure = structures.find((structure) => structure.name === profileForm.structuur);
    if (!matchingStructure) return;
    setProfileForm((prev) =>
      prev
        ? {
            ...prev,
            structure_id: matchingStructure.id,
          }
        : prev
    );
  }, [profileForm, structures]);

  useEffect(() => {
    if (!profileForm || !profileForm.structure_id || profileForm.department_id || !profileForm.afdeling || departments.length === 0) {
      return;
    }
    const matchingDepartment = departments.find((department) => department.name === profileForm.afdeling);
    if (!matchingDepartment) return;
    setProfileForm((prev) =>
      prev
        ? {
            ...prev,
            department_id: matchingDepartment.id,
          }
        : prev
    );
  }, [departments, profileForm]);

  if (!isAdmin()) {
    return (
      <div className="user-details-page">
        <h1>User Details</h1>
        <p className="ud-error">Geen toegang.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="user-details-page">
        <p>Laden...</p>
      </div>
    );
  }

  if (!id || !user || !profileForm || !visibility) {
    return (
      <div className="user-details-page">
        <Link to="/user-management" className="btn-secondary">
          Terug
        </Link>
        {error ? <p className="ud-error">{error}</p> : <p>Geen gegevens beschikbaar.</p>}
      </div>
    );
  }

  const userId = id;
  const form = profileForm;
  const pageVisibility = visibility;
  const rankOptions = getRankOptions(ranks, form.rang);

  function updateStructureId(structureId: string) {
    const nextStructure = structures.find((structure) => structure.id === structureId);
    setProfileForm((prev) =>
      prev
        ? {
            ...prev,
            structure_id: structureId,
            department_id: '',
            structuur: nextStructure?.name ?? '',
            afdeling: '',
          }
        : prev
    );
  }

  function updateDepartmentId(departmentId: string) {
    const nextDepartment = departments.find((department) => department.id === departmentId);
    setProfileForm((prev) =>
      prev
        ? {
            ...prev,
            department_id: departmentId,
            afdeling: nextDepartment?.name ?? '',
          }
        : prev
    );
  }

  async function saveProfile() {
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const payload: UpdateUserData = {
        first_name: form.first_name,
        last_name: form.last_name,
        email: form.email,
        role: form.role,
        is_active: form.is_active,
        is_medewerker: form.is_medewerker,
        allow_multiple_sessions: form.allow_multiple_sessions,
        telefoonnummer: form.telefoonnummer,
        rang: form.rang,
        organisatie: form.organisatie,
        structuur: selectedStructure?.name ?? form.structuur,
        afdeling: selectedDepartment?.name ?? form.afdeling,
      };
      await AuthService.updateUser(userId, payload);
      await AuthService.logActivity(userId, 'profile_update', true);
      setMessage('Profiel opgeslagen.');
      await loadData(userId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Opslaan mislukt.');
    } finally {
      setSaving(false);
    }
  }

  async function toggleVisibility(pageKey: (typeof USER_PAGE_KEYS)[number], nextVisible: boolean) {
    setError('');
    setMessage('');
    try {
      await AuthService.setUserPageVisibility(userId, pageKey, nextVisible);
      setVisibility((prev) => (prev ? { ...prev, [pageKey]: nextVisible } : prev));
      setMessage(`Pagina-zichtbaarheid voor "${pageKey}" bijgewerkt.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Opslaan zichtbaarheid mislukt.');
    }
  }

  async function saveSessionTimeout() {
    setSaving(true);
    setError('');
    setMessage('');
    try {
      await AuthService.setUserSessionTimeout(userId, timeoutMinutes, timeoutType);
      setMessage('Sessie-timeout opgeslagen.');
      await loadData(userId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Opslaan sessie-timeout mislukt.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="user-details-page">
      <div className="ud-header">
        <h1>User Details: {user.username}</h1>
        <Link to="/user-management" className="btn-secondary">
          Terug naar overzicht
        </Link>
      </div>

      {error ? <div className="ud-error">{error}</div> : null}
      {message ? <div className="ud-success">{message}</div> : null}

      <section className="ud-card">
        <h2>Profiel</h2>
        <div className="ud-grid">
          <label>
            Voornaam
            <input
              value={form.first_name}
              onChange={(e) => setProfileForm((prev) => (prev ? { ...prev, first_name: e.target.value } : prev))}
            />
          </label>
          <label>
            Achternaam
            <input
              value={form.last_name}
              onChange={(e) => setProfileForm((prev) => (prev ? { ...prev, last_name: e.target.value } : prev))}
            />
          </label>
          <label>
            E-mail
            <input
              type="email"
              value={form.email}
              onChange={(e) => setProfileForm((prev) => (prev ? { ...prev, email: e.target.value } : prev))}
            />
          </label>
          <label>
            Rol
            <select
              value={form.role}
              onChange={(e) => setProfileForm((prev) => (prev ? { ...prev, role: e.target.value as AppUser['role'] } : prev))}
            >
              <option value="user">user</option>
              <option value="super_user">super_user</option>
              <option value="admin">admin</option>
            </select>
          </label>
          <label className="ud-switch-field">
            <span>Actief</span>
            <span className="ud-switch-control">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(e) => setProfileForm((prev) => (prev ? { ...prev, is_active: e.target.checked } : prev))}
              />
              <span className="ud-switch-slider" aria-hidden="true" />
            </span>
          </label>
          <label className="ud-switch-field">
            <span>Medewerker</span>
            <span className="ud-switch-control">
              <input
                type="checkbox"
                checked={form.is_medewerker}
                onChange={(e) => setProfileForm((prev) => (prev ? { ...prev, is_medewerker: e.target.checked } : prev))}
              />
              <span className="ud-switch-slider" aria-hidden="true" />
            </span>
          </label>
          <label>
            Telefoonnummer
            <input
              value={form.telefoonnummer}
              onChange={(e) => setProfileForm((prev) => (prev ? { ...prev, telefoonnummer: e.target.value } : prev))}
            />
          </label>
          <label>
            Rang
            <select
              value={form.rang}
              onChange={(e) => setProfileForm((prev) => (prev ? { ...prev, rang: e.target.value } : prev))}
            >
              <option value="">Selecteer rang</option>
              {rankOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Organisatie
            <input
              value={form.organisatie}
              onChange={(e) => setProfileForm((prev) => (prev ? { ...prev, organisatie: e.target.value } : prev))}
            />
          </label>
          <label>
            Structuur
            <select value={form.structure_id} onChange={(e) => updateStructureId(e.target.value)}>
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
              value={form.department_id}
              onChange={(e) => updateDepartmentId(e.target.value)}
              disabled={!form.structure_id}
            >
              <option value="">{form.structure_id ? 'Selecteer afdeling' : 'Kies eerst een structuur'}</option>
              {departments.map((department) => (
                <option key={department.id} value={department.id}>
                  {department.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="ud-actions">
          <button type="button" className="btn-primary" onClick={() => void saveProfile()} disabled={saving}>
            {saving ? 'Opslaan...' : 'Profiel opslaan'}
          </button>
        </div>
      </section>

      <section className="ud-card">
        <h2>Page Visibility</h2>
        <div className="ud-visibility-list">
          {USER_PAGE_KEYS.map((pageKey) => (
            <label key={pageKey} className="ud-visibility-item">
              <span>{pageKey}</span>
              <span className="ud-switch-control">
                <input
                  type="checkbox"
                  checked={pageVisibility[pageKey] !== false}
                  onChange={(e) => void toggleVisibility(pageKey, e.target.checked)}
                />
                <span className="ud-switch-slider" aria-hidden="true" />
              </span>
            </label>
          ))}
        </div>
      </section>

      <section className="ud-card">
        <h2>Sessie-timeout</h2>
        <div className="ud-timeout-row">
          <label>
            Minuten
            <select
              value={timeoutMinutes === null ? 'null' : String(timeoutMinutes)}
              onChange={(e) => {
                const value = e.target.value;
                setTimeoutMinutes(value === 'null' ? null : (Number(value) as SessionTimeoutMinutes));
              }}
            >
              <option value="null">Nooit</option>
              <option value="10">10</option>
              <option value="30">30</option>
              <option value="60">60</option>
            </select>
          </label>
          <label>
            Type
            <select value={timeoutType} onChange={(e) => setTimeoutType(e.target.value as SessionTimeoutType)}>
              <option value="since_login">Verloop ongeacht activiteit</option>
              <option value="inactivity">Verloop na inactiviteit</option>
            </select>
          </label>
          <button type="button" className="btn-primary" onClick={() => void saveSessionTimeout()} disabled={saving}>
            {saving ? 'Opslaan...' : 'Sessie-timeout opslaan'}
          </button>
        </div>
      </section>

      <section className="ud-card">
        <h2>Apparaatbeheer</h2>
        <label className="ud-switch-field">
          <span>Meerdere apparaten toestaan</span>
          <span className="ud-switch-control">
            <input
              type="checkbox"
              checked={form.role === 'admin' ? true : form.allow_multiple_sessions}
              disabled={form.role === 'admin'}
              onChange={(e) =>
                setProfileForm((prev) =>
                  prev ? { ...prev, allow_multiple_sessions: e.target.checked } : prev
                )
              }
            />
            <span className="ud-switch-slider" aria-hidden="true" />
          </span>
        </label>
        <p className="ud-helper-text">
          {form.role === 'admin'
            ? 'Admins kunnen altijd op meerdere apparaten tegelijk ingelogd zijn.'
            : 'Wanneer dit aan staat, kan deze gebruiker op meerdere apparaten tegelijk ingelogd blijven.'}
        </p>
      </section>
    </div>
  );
}

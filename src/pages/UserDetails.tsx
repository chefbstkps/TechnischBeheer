import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import * as AuthService from '../services/authService';
import {
  USER_PAGE_KEYS,
  type AppUser,
  type SessionTimeoutMinutes,
  type SessionTimeoutType,
  type UpdateUserData,
  type UserPageVisibility,
} from '../types/auth';
import './UserDetails.css';

interface ProfileFormState {
  first_name: string;
  last_name: string;
  email: string;
  role: AppUser['role'];
  is_active: boolean;
  telefoonnummer: string;
  rang: string;
  organisatie: string;
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
        telefoonnummer: currentUser.telefoonnummer ?? '',
        rang: currentUser.rang ?? '',
        organisatie: currentUser.organisatie ?? '',
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
        telefoonnummer: form.telefoonnummer,
        rang: form.rang,
        organisatie: form.organisatie,
        structuur: form.structuur,
        afdeling: form.afdeling,
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
          <label className="ud-checkbox">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(e) => setProfileForm((prev) => (prev ? { ...prev, is_active: e.target.checked } : prev))}
            />
            Actief
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
            <input
              value={form.rang}
              onChange={(e) => setProfileForm((prev) => (prev ? { ...prev, rang: e.target.value } : prev))}
            />
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
            <input
              value={form.structuur}
              onChange={(e) => setProfileForm((prev) => (prev ? { ...prev, structuur: e.target.value } : prev))}
            />
          </label>
          <label>
            Afdeling
            <input
              value={form.afdeling}
              onChange={(e) => setProfileForm((prev) => (prev ? { ...prev, afdeling: e.target.value } : prev))}
            />
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
              <input
                type="checkbox"
                checked={pageVisibility[pageKey] !== false}
                onChange={(e) => void toggleVisibility(pageKey, e.target.checked)}
              />
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
    </div>
  );
}

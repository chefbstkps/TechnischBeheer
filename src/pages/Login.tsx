import { useState } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Eye, EyeOff } from 'lucide-react';
import type { LoginConflict } from '../types/auth';
import packageJson from '../../package.json';
import './Login.css';

export default function Login() {
  const { user, loading, signIn } = useAuth();
  const location = useLocation();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [conflict, setConflict] = useState<LoginConflict | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const from = (location.state as { from?: { pathname: string } })?.from?.pathname ?? '/';

  if (loading) {
    return (
      <div className="login-page">
        <div className="login-card">
          <img src="/tb.svg" alt="Technisch Beheer" className="login-logo" />
          <p style={{ color: 'var(--text-secondary)' }}>Laden...</p>
        </div>
      </div>
    );
  }

  if (user) {
    return <Navigate to={from} replace />;
  }

  function formatConflictDate(value?: string | null): string | null {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return date.toLocaleString('nl-NL');
  }

  async function submitLogin(forceTakeover = false) {
    setError('');
    if (!forceTakeover) {
      setConflict(null);
    }
    if (!username.trim()) {
      setError('Vul een gebruikersnaam in.');
      return;
    }
    if (!password) {
      setError('Vul een wachtwoord in.');
      return;
    }
    setSubmitting(true);
    try {
      const result = await signIn({ username: username.trim(), password }, { forceTakeover });
      if (result.status === 'conflict') {
        setConflict(result.conflict);
        return;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Inloggen mislukt.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await submitLogin(false);
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <img src="/tb-w.svg" alt="Technisch Beheer" className="login-logo" />
        <h1 className="login-title">Technisch Beheer</h1>
        <p className="login-subtitle">Log in om door te gaan</p>

        <form onSubmit={handleSubmit} className="login-form">
          {error && (
            <div className="login-error" role="alert">
              {error}
            </div>
          )}
          {conflict && (
            <div className="login-conflict" role="alert">
              <p>{conflict.message}</p>
              {conflict.userAgent ? <p>Ander apparaat: {conflict.userAgent}</p> : null}
              {conflict.ipAddress ? <p>IP-adres: {conflict.ipAddress}</p> : null}
              {formatConflictDate(conflict.createdAt) ? (
                <p>Actieve sessie sinds: {formatConflictDate(conflict.createdAt)}</p>
              ) : null}
              <p>
                Als je hier doorgaat, wordt de sessie op het andere apparaat automatisch uitgelogd.
              </p>
              <div className="login-conflict-actions">
                <button
                  type="button"
                  className="btn-primary login-submit"
                  disabled={submitting}
                  onClick={() => void submitLogin(true)}
                >
                  {submitting ? 'Bezig...' : 'Doorgaan op dit apparaat'}
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={submitting}
                  onClick={() => setConflict(null)}
                >
                  Annuleren
                </button>
              </div>
            </div>
          )}
          <div className="login-field">
            <label htmlFor="login-username">Gebruikersnaam</label>
            <input
              id="login-username"
              type="text"
              autoComplete="username"
              value={username}
              onChange={(e) => {
                setUsername(e.target.value);
                setConflict(null);
              }}
              placeholder="Gebruikersnaam"
              disabled={submitting}
            />
          </div>
          <div className="login-field">
            <label htmlFor="login-password">Wachtwoord</label>
            <div className="login-password-wrap">
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setConflict(null);
                }}
                placeholder="Wachtwoord"
                disabled={submitting}
              />
              <button
                type="button"
                className="login-toggle-pwd"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Wachtwoord verbergen' : 'Wachtwoord tonen'}
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>
          <button type="submit" className="btn-primary login-submit" disabled={submitting}>
            {submitting ? 'Bezig...' : 'Inloggen'}
          </button>
        </form>
        <p className="login-signup-link">
          Nog geen account? <Link to="/signup">Registreer hier</Link>
        </p>
        <span className="login-version">v{packageJson.version}</span>
      </div>
    </div>
  );
}

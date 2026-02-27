import { useState } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Eye, EyeOff } from 'lucide-react';
import './Login.css';

export default function Login() {
  const { user, loading, signIn } = useAuth();
  const location = useLocation();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const from = (location.state as { from?: { pathname: string } })?.from?.pathname ?? '/';

  if (loading) {
    return (
      <div className="login-page">
        <div className="login-card">
          <p style={{ color: 'var(--text-secondary)' }}>Laden...</p>
        </div>
      </div>
    );
  }

  if (user) {
    return <Navigate to={from} replace />;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
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
      await signIn({ username: username.trim(), password });
      // Navigate is handled by redirect / state update
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Inloggen mislukt.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <h1 className="login-title">Technisch Beheer</h1>
        <p className="login-subtitle">Log in om door te gaan</p>

        <form onSubmit={handleSubmit} className="login-form">
          {error && (
            <div className="login-error" role="alert">
              {error}
            </div>
          )}
          <div className="login-field">
            <label htmlFor="login-username">Gebruikersnaam</label>
            <input
              id="login-username"
              type="text"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
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
                onChange={(e) => setPassword(e.target.value)}
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
      </div>
    </div>
  );
}

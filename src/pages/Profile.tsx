import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import * as AuthService from '../services/authService';
import type { ChangePasswordData } from '../types/auth';
import { Eye, EyeOff } from 'lucide-react';
import './Profile.css';

export default function Profile() {
  const { user, refreshUser } = useAuth();
  const [activeTab, setActiveTab] = useState<'profile' | 'password'>(user?.must_change_password ? 'password' : 'profile');
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [current_password, setCurrent_password] = useState('');
  const [new_password, setNew_password] = useState('');
  const [confirm_password, setConfirm_password] = useState('');

  if (!user) return null;
  const mustChangePassword = user.must_change_password;

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setPasswordError('');
    setPasswordMessage('');
    if (new_password !== confirm_password) {
      setPasswordError('Nieuw wachtwoord en bevestiging komen niet overeen.');
      return;
    }
    if (new_password.length < 8) {
      setPasswordError('Nieuw wachtwoord moet minimaal 8 tekens zijn.');
      return;
    }
    setPasswordSaving(true);
    try {
      const data: ChangePasswordData = {
        current_password,
        new_password,
        confirm_password,
      };
      await AuthService.changePassword(user.id, data);
      await refreshUser();
      setPasswordMessage('Wachtwoord is gewijzigd.');
      setCurrent_password('');
      setNew_password('');
      setConfirm_password('');
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : 'Wachtwoord wijzigen mislukt.');
    } finally {
      setPasswordSaving(false);
    }
  }

  return (
    <div className="profile-page">
      <h1 className="profile-title">Mijn profiel</h1>

      {mustChangePassword ? (
        <div className="profile-warning" role="alert">
          Je wachtwoord is gereset. Wijzig eerst je wachtwoord voordat je verder kunt in de app.
        </div>
      ) : null}

      <div className="profile-tabs">
        <button
          type="button"
          className={`profile-tab ${activeTab === 'profile' ? 'active' : ''}`}
          onClick={() => {
            if (!mustChangePassword) setActiveTab('profile');
          }}
          disabled={mustChangePassword}
        >
          Profiel
        </button>
        <button
          type="button"
          className={`profile-tab ${activeTab === 'password' ? 'active' : ''}`}
          onClick={() => setActiveTab('password')}
        >
          Wachtwoord wijzigen
        </button>
      </div>

      {activeTab === 'profile' && (
        <div className="profile-card">
          <div className="profile-form">
            <div className="profile-field">
              <label>Gebruikersnaam</label>
              <input type="text" value={user.username} readOnly disabled />
            </div>
            <div className="profile-field">
              <label>Rol</label>
              <input type="text" value={user.role} readOnly disabled />
            </div>
            <div className="profile-field">
              <label>Voornaam</label>
              <input type="text" value={user.first_name} readOnly disabled />
            </div>
            <div className="profile-field">
              <label>Achternaam</label>
              <input type="text" value={user.last_name} readOnly disabled />
            </div>
            <div className="profile-field">
              <label>E-mail</label>
              <input type="email" value={user.email} readOnly disabled />
            </div>
            {user.last_login && (
              <div className="profile-field">
                <label>Laatste login</label>
                <input
                  type="text"
                  value={new Date(user.last_login).toLocaleString('nl-NL')}
                  readOnly
                  disabled
                />
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'password' && (
        <div className="profile-card">
          <form onSubmit={handlePasswordSubmit} className="profile-form">
            {passwordError && <div className="profile-error" role="alert">{passwordError}</div>}
            {passwordMessage && <div className="profile-success" role="status">{passwordMessage}</div>}
            <div className="profile-field">
              <label htmlFor="current-pwd">Huidig wachtwoord</label>
              <div className="profile-pwd-wrap">
                <input
                  id="current-pwd"
                  type={showCurrent ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={current_password}
                  onChange={(e) => setCurrent_password(e.target.value)}
                  required
                  disabled={passwordSaving}
                />
                <button
                  type="button"
                  className="profile-pwd-toggle"
                  onClick={() => setShowCurrent((v) => !v)}
                  aria-label={showCurrent ? 'Verbergen' : 'Tonen'}
                  tabIndex={-1}
                >
                  {showCurrent ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
            <div className="profile-field">
              <label htmlFor="new-pwd">Nieuw wachtwoord</label>
              <div className="profile-pwd-wrap">
                <input
                  id="new-pwd"
                  type={showNew ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={new_password}
                  onChange={(e) => setNew_password(e.target.value)}
                  required
                  minLength={8}
                  disabled={passwordSaving}
                />
                <button
                  type="button"
                  className="profile-pwd-toggle"
                  onClick={() => setShowNew((v) => !v)}
                  aria-label={showNew ? 'Verbergen' : 'Tonen'}
                  tabIndex={-1}
                >
                  {showNew ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
            <div className="profile-field">
              <label htmlFor="confirm-pwd">Bevestig nieuw wachtwoord</label>
              <div className="profile-pwd-wrap">
                <input
                  id="confirm-pwd"
                  type={showConfirm ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={confirm_password}
                  onChange={(e) => setConfirm_password(e.target.value)}
                  required
                  minLength={8}
                  disabled={passwordSaving}
                />
                <button
                  type="button"
                  className="profile-pwd-toggle"
                  onClick={() => setShowConfirm((v) => !v)}
                  aria-label={showConfirm ? 'Verbergen' : 'Tonen'}
                  tabIndex={-1}
                >
                  {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
            <p className="profile-info">
              Nieuw wachtwoord moet minimaal 8 tekens bevatten.
            </p>
            <button type="submit" className="btn-primary" disabled={passwordSaving}>
              {passwordSaving ? 'Bezig...' : 'Wachtwoord wijzigen'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

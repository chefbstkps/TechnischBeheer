import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import * as AuthService from '../services/authService';
import './Signup.css';

interface SignupFormState {
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  password: string;
  confirm_password: string;
  telefoonnummer: string;
  rang: string;
  organisatie: string;
  structuur: string;
  afdeling: string;
}

const INITIAL_FORM: SignupFormState = {
  username: '',
  email: '',
  first_name: '',
  last_name: '',
  password: '',
  confirm_password: '',
  telefoonnummer: '',
  rang: '',
  organisatie: '',
  structuur: '',
  afdeling: '',
};

export default function Signup() {
  const { user, loading } = useAuth();
  const [form, setForm] = useState<SignupFormState>(INITIAL_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  if (loading) {
    return (
      <div className="signup-page">
        <div className="signup-card">Laden...</div>
      </div>
    );
  }

  if (user) {
    return <Navigate to="/" replace />;
  }

  function updateField<K extends keyof SignupFormState>(key: K, value: SignupFormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!form.username.trim() || !form.email.trim() || !form.first_name.trim() || !form.last_name.trim()) {
      setError('Vul alle verplichte velden in.');
      return;
    }
    if (form.password.length < 6) {
      setError('Wachtwoord moet minimaal 6 tekens bevatten.');
      return;
    }
    if (form.password !== form.confirm_password) {
      setError('Wachtwoord en bevestiging komen niet overeen.');
      return;
    }

    setSubmitting(true);
    try {
      await AuthService.signup({
        username: form.username.trim(),
        email: form.email.trim(),
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        password: form.password,
        telefoonnummer: form.telefoonnummer,
        rang: form.rang,
        organisatie: form.organisatie,
        structuur: form.structuur,
        afdeling: form.afdeling,
      });

      setForm(INITIAL_FORM);
      setSuccess('Account aangemaakt. Een admin moet je account eerst activeren.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registratie mislukt.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="signup-page">
      <div className="signup-card">
        <h1>Registreren</h1>
        <p className="signup-subtitle">Maak een account aan. Na goedkeuring door een admin kun je inloggen.</p>

        <form onSubmit={handleSubmit} className="signup-form">
          {error ? <div className="signup-error">{error}</div> : null}
          {success ? <div className="signup-success">{success}</div> : null}

          <div className="signup-grid">
            <label>
              Gebruikersnaam *
              <input value={form.username} onChange={(e) => updateField('username', e.target.value)} disabled={submitting} />
            </label>
            <label>
              E-mail *
              <input type="email" value={form.email} onChange={(e) => updateField('email', e.target.value)} disabled={submitting} />
            </label>
            <label>
              Voornaam *
              <input value={form.first_name} onChange={(e) => updateField('first_name', e.target.value)} disabled={submitting} />
            </label>
            <label>
              Achternaam *
              <input value={form.last_name} onChange={(e) => updateField('last_name', e.target.value)} disabled={submitting} />
            </label>
            <label>
              Wachtwoord *
              <input
                type="password"
                value={form.password}
                onChange={(e) => updateField('password', e.target.value)}
                minLength={6}
                disabled={submitting}
              />
            </label>
            <label>
              Bevestig wachtwoord *
              <input
                type="password"
                value={form.confirm_password}
                onChange={(e) => updateField('confirm_password', e.target.value)}
                minLength={6}
                disabled={submitting}
              />
            </label>
            <label>
              Telefoonnummer
              <input value={form.telefoonnummer} onChange={(e) => updateField('telefoonnummer', e.target.value)} disabled={submitting} />
            </label>
            <label>
              Rang
              <input value={form.rang} onChange={(e) => updateField('rang', e.target.value)} disabled={submitting} />
            </label>
            <label>
              Organisatie
              <input value={form.organisatie} onChange={(e) => updateField('organisatie', e.target.value)} disabled={submitting} />
            </label>
            <label>
              Structuur
              <input value={form.structuur} onChange={(e) => updateField('structuur', e.target.value)} disabled={submitting} />
            </label>
            <label>
              Afdeling
              <input value={form.afdeling} onChange={(e) => updateField('afdeling', e.target.value)} disabled={submitting} />
            </label>
          </div>

          <button type="submit" className="btn-primary" disabled={submitting}>
            {submitting ? 'Bezig...' : 'Account aanmaken'}
          </button>
        </form>

        <p className="signup-footer">
          Al een account? <Link to="/login">Ga naar login</Link>
        </p>
      </div>
    </div>
  );
}

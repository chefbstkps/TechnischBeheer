import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import * as AuthService from '../services/authService';
import { OrganisationService } from '../services/organisationService';
import { getRankOptions } from '../utils/ranks';
import './Signup.css';

const DEFAULT_ORGANISATIE = 'Politie';
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;

type AsyncFieldStatus = 'idle' | 'checking' | 'valid' | 'invalid';

interface AsyncFieldState {
  status: AsyncFieldStatus;
  message: string;
}

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
  structure_id: string;
  department_id: string;
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
  organisatie: DEFAULT_ORGANISATIE,
  structure_id: '',
  department_id: '',
};

const IDLE_FIELD_STATE: AsyncFieldState = {
  status: 'idle',
  message: '',
};

function getEmailValidationMessage(value: string): string {
  const trimmedValue = value.trim();
  if (!trimmedValue) return '';
  if (!EMAIL_REGEX.test(trimmedValue)) {
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

function getFieldHintClass(status: AsyncFieldStatus): string {
  if (status === 'valid') return 'signup-field-hint signup-field-hint-success';
  if (status === 'invalid') return 'signup-field-hint signup-field-hint-error';
  return 'signup-field-hint signup-field-hint-muted';
}

export default function Signup() {
  const { user, loading } = useAuth();
  const [form, setForm] = useState<SignupFormState>(INITIAL_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [usernameAvailability, setUsernameAvailability] = useState<AsyncFieldState>(IDLE_FIELD_STATE);
  const [emailAvailability, setEmailAvailability] = useState<AsyncFieldState>(IDLE_FIELD_STATE);

  const { data: ranks = [] } = useQuery({
    queryKey: ['ranks'],
    queryFn: () => OrganisationService.listRanks(),
  });
  const { data: structures = [], isLoading: structuresLoading } = useQuery({
    queryKey: ['structures'],
    queryFn: () => OrganisationService.listStructures(),
  });
  const { data: departments = [], isLoading: departmentsLoading } = useQuery({
    queryKey: ['departments', form.structure_id],
    queryFn: () => OrganisationService.listDepartments(form.structure_id),
    enabled: !!form.structure_id,
  });

  const rankOptions = useMemo(() => getRankOptions(ranks), [ranks]);
  const selectedStructure = useMemo(
    () => structures.find((structure) => structure.id === form.structure_id) ?? null,
    [form.structure_id, structures]
  );
  const selectedDepartment = useMemo(
    () => departments.find((department) => department.id === form.department_id) ?? null,
    [departments, form.department_id]
  );
  const emailValidationMessage = useMemo(() => getEmailValidationMessage(form.email), [form.email]);
  const passwordValidationMessage = useMemo(
    () => getPasswordValidationMessage(form.password),
    [form.password]
  );
  const confirmPasswordValidationMessage = useMemo(
    () => getConfirmPasswordValidationMessage(form.password, form.confirm_password),
    [form.confirm_password, form.password]
  );

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
    setError('');
    setSuccess('');
    setForm((prev) => ({
      ...prev,
      [key]: value,
      ...(key === 'structure_id' ? { department_id: '' } : {}),
    }));
  }

  useEffect(() => {
    const username = form.username.trim();
    if (!username) {
      setUsernameAvailability(IDLE_FIELD_STATE);
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
  }, [form.username]);

  useEffect(() => {
    const email = form.email.trim();
    if (!email) {
      setEmailAvailability(IDLE_FIELD_STATE);
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
  }, [emailValidationMessage, form.email]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!form.username.trim() || !form.email.trim() || !form.first_name.trim() || !form.last_name.trim()) {
      setError('Vul alle verplichte velden in.');
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

    setSubmitting(true);
    try {
      const [usernameAvailable, emailAvailable] = await Promise.all([
        AuthService.isUsernameAvailable(form.username),
        AuthService.isEmailAvailable(form.email),
      ]);

      if (!usernameAvailable) {
        const message = 'Deze gebruikersnaam bestaat al.';
        setUsernameAvailability({ status: 'invalid', message });
        setError(message);
        return;
      }

      if (!emailAvailable) {
        const message = 'Dit e-mailadres bestaat al.';
        setEmailAvailability({ status: 'invalid', message });
        setError(message);
        return;
      }

      await AuthService.signup({
        username: form.username.trim(),
        email: form.email.trim(),
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        password: form.password,
        telefoonnummer: form.telefoonnummer,
        rang: form.rang,
        organisatie: DEFAULT_ORGANISATIE,
        structuur: selectedStructure?.name ?? '',
        afdeling: selectedDepartment?.name ?? '',
      });

      setForm(INITIAL_FORM);
      setUsernameAvailability(IDLE_FIELD_STATE);
      setEmailAvailability(IDLE_FIELD_STATE);
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
        <img src="/tb-w.svg" alt="Technisch Beheer" className="signup-corner-logo" />
        <h1>Registreren</h1>
        <p className="signup-subtitle">Maak een account aan. Na goedkeuring door een admin kun je inloggen.</p>

        <form onSubmit={handleSubmit} className="signup-form">
          {error ? <div className="signup-error">{error}</div> : null}
          {success ? <div className="signup-success">{success}</div> : null}

          <div className="signup-grid">
            <label>
              Gebruikersnaam *
              <input
                value={form.username}
                onChange={(e) => updateField('username', e.target.value)}
                disabled={submitting}
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
                value={form.email}
                onChange={(e) => updateField('email', e.target.value)}
                disabled={submitting}
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
                value={form.first_name}
                onChange={(e) => updateField('first_name', e.target.value)}
                disabled={submitting}
                required
              />
            </label>
            <label>
              Achternaam *
              <input
                value={form.last_name}
                onChange={(e) => updateField('last_name', e.target.value)}
                disabled={submitting}
                required
              />
            </label>
            <label>
              Wachtwoord *
              <input
                type="password"
                value={form.password}
                onChange={(e) => updateField('password', e.target.value)}
                disabled={submitting}
                required
              />
              {passwordValidationMessage ? (
                <span className="signup-field-hint signup-field-hint-error">
                  {passwordValidationMessage}
                </span>
              ) : (
                <span className="signup-field-hint signup-field-hint-muted">
                  Minimaal 8 tekens, met minstens 1 kleine letter, 1 hoofdletter en 1 cijfer.
                </span>
              )}
            </label>
            <label>
              Bevestig wachtwoord *
              <input
                type="password"
                value={form.confirm_password}
                onChange={(e) => updateField('confirm_password', e.target.value)}
                disabled={submitting}
                required
              />
              {confirmPasswordValidationMessage ? (
                <span className="signup-field-hint signup-field-hint-error">
                  {confirmPasswordValidationMessage}
                </span>
              ) : null}
            </label>
            <label>
              Telefoonnummer
              <input value={form.telefoonnummer} onChange={(e) => updateField('telefoonnummer', e.target.value)} disabled={submitting} />
            </label>
            <label>
              Rang
              <select value={form.rang} onChange={(e) => updateField('rang', e.target.value)} disabled={submitting}>
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
              <input value={form.organisatie} readOnly disabled />
            </label>
            <label>
              Structuur
              <select
                value={form.structure_id}
                onChange={(e) => updateField('structure_id', e.target.value)}
                disabled={submitting || structuresLoading}
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
                value={form.department_id}
                onChange={(e) => updateField('department_id', e.target.value)}
                disabled={submitting || !form.structure_id || departmentsLoading}
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

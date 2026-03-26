import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import * as AuthService from '../services/authService';
import { OrganisationService } from '../services/organisationService';
import type { AppUser } from '../types/auth';
import { compareUsersByRankOrder } from '../utils/ranks';
import './Medewerkers.css';

function matchesQuery(user: AppUser, query: string): boolean {
  if (!query) return true;
  const haystack = [
    user.username,
    user.first_name,
    user.last_name,
    user.rang ?? '',
    user.organisatie ?? '',
    user.structuur ?? '',
    user.afdeling ?? '',
    user.telefoonnummer ?? '',
  ]
    .join(' ')
    .toLowerCase();

  return haystack.includes(query);
}

export default function Medewerkers() {
  const [searchQuery, setSearchQuery] = useState('');
  const { data: users = [], isLoading, error, refetch } = useQuery({
    queryKey: ['medewerkers'],
    queryFn: () => AuthService.getAllUsers(),
  });

  const { data: ranks = [] } = useQuery({
    queryKey: ['ranks'],
    queryFn: () => OrganisationService.listRanks(),
  });

  const medewerkers = useMemo(
    () =>
      users
        .filter((user) => user.is_medewerker && user.is_active)
        .filter((user) => matchesQuery(user, searchQuery.trim().toLowerCase()))
        .sort((a, b) => compareUsersByRankOrder(a, b, ranks)),
    [users, searchQuery, ranks]
  );

  return (
    <div className="medewerkers-page">
      <div className="medewerkers-header">
        <div>
          <h1>Medewerkers</h1>
          <p className="medewerkers-subtitle">
            Overzicht van actieve medewerkers binnen de applicatie.
          </p>
        </div>
        <button type="button" className="btn-secondary" onClick={() => void refetch()} disabled={isLoading}>
          Vernieuwen
        </button>
      </div>

      <section className="medewerkers-card medewerkers-toolbar">
        <div className="medewerkers-search-wrap">
          <Search size={18} className="medewerkers-search-icon" aria-hidden />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Zoeken op naam, rang, organisatie, structuur of afdeling"
            aria-label="Zoeken naar medewerkers"
          />
        </div>
        <div className="medewerkers-count">{medewerkers.length} medewerker(s)</div>
      </section>

      <section className="medewerkers-card">
        {error ? (
          <div className="medewerkers-error">
            {error instanceof Error ? error.message : 'Medewerkers laden mislukt.'}
          </div>
        ) : isLoading ? (
          <p>Laden...</p>
        ) : (
          <div className="medewerkers-table-wrap">
            <table className="medewerkers-table">
              <thead>
                <tr>
                  <th>Naam</th>
                  <th>Gebruikersnaam</th>
                  <th>Rang</th>
                  <th>Organisatie</th>
                  <th>Structuur</th>
                  <th>Afdeling</th>
                  <th>Telefoonnummer</th>
                </tr>
              </thead>
              <tbody>
                {medewerkers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="medewerkers-empty">
                      Geen medewerkers gevonden.
                    </td>
                  </tr>
                ) : (
                  medewerkers.map((user) => (
                    <tr key={user.id}>
                      <td>{`${user.first_name} ${user.last_name}`.trim()}</td>
                      <td>{user.username}</td>
                      <td>{user.rang ?? '-'}</td>
                      <td>{user.organisatie ?? '-'}</td>
                      <td>{user.structuur ?? '-'}</td>
                      <td>{user.afdeling ?? '-'}</td>
                      <td>{user.telefoonnummer ?? '-'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

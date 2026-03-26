import { RefreshCw, X } from 'lucide-react';
import { useVersionCheck } from '../hooks/useVersionCheck';
import './UpdateBanner.css';

export default function UpdateBanner() {
  const { updateAvailable, currentVersion, latestVersion, dismiss } = useVersionCheck();

  if (!updateAvailable) return null;

  return (
    <div className="update-banner">
      <div className="update-banner-content">
        <RefreshCw size={18} className="update-banner-icon" />
        <span>
          Er is een nieuwe versie beschikbaar: <strong>v{latestVersion}</strong>{' '}
          <span className="update-banner-current">(huidig: v{currentVersion})</span>
        </span>
        <button
          type="button"
          className="update-banner-btn"
          onClick={() => window.location.reload()}
        >
          Nu bijwerken
        </button>
      </div>
      <button type="button" className="update-banner-close" onClick={dismiss} aria-label="Sluiten">
        <X size={16} />
      </button>
    </div>
  );
}

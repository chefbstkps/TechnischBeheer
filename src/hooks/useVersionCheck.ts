import { useCallback, useEffect, useRef, useState } from 'react';
import packageJson from '../../package.json';

const CHECK_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const CURRENT_VERSION = packageJson.version ?? '0.0.0';

export interface VersionStatus {
  updateAvailable: boolean;
  currentVersion: string;
  latestVersion: string | null;
  dismiss: () => void;
}

export function useVersionCheck(): VersionStatus {
  const [latestVersion, setLatestVersion] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const check = useCallback(async () => {
    try {
      const res = await fetch(`/version.json?_t=${Date.now()}`, { cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();
      if (typeof data?.version === 'string') {
        setLatestVersion(data.version);
      }
    } catch {
      // offline / fetch failed — ignore
    }
  }, []);

  useEffect(() => {
    void check();
    timerRef.current = setInterval(() => void check(), CHECK_INTERVAL_MS);
    const handleFocus = () => void check();
    window.addEventListener('focus', handleFocus);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      window.removeEventListener('focus', handleFocus);
    };
  }, [check]);

  const updateAvailable =
    latestVersion !== null &&
    latestVersion !== CURRENT_VERSION &&
    latestVersion !== dismissed;

  const dismiss = useCallback(() => {
    if (latestVersion) setDismissed(latestVersion);
  }, [latestVersion]);

  return { updateAvailable, currentVersion: CURRENT_VERSION, latestVersion, dismiss };
}

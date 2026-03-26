import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { USER_PAGE_KEYS, type UserPageKey } from '../types/auth';

const PATH_TO_PAGE_KEY: Record<string, UserPageKey> = {
  '/': 'dashboard',
  '/profile': 'profile',
  '/organisatie': 'organisatie',
  '/brands': 'brands',
  '/automontage': 'automontage',
  '/werkzaamheden': 'werkzaamheden',
  '/reparaties': 'reparaties',
  '/medewerkers': 'medewerkers',
  '/activity-log': 'activity_log',
  '/onderdelen': 'onderdelen',
  '/user-management': 'user_management',
  '/users-log': 'users_log',
};

function resolvePageKey(pathname: string): UserPageKey | undefined {
  if (PATH_TO_PAGE_KEY[pathname]) {
    return PATH_TO_PAGE_KEY[pathname];
  }

  if (pathname.startsWith('/automontage/')) return 'automontage';
  if (pathname.startsWith('/werkzaamheden/')) return 'werkzaamheden';
  if (pathname.startsWith('/user-management/')) return 'user_management';

  return undefined;
}

export default function PageVisibilityGuard() {
  const { user } = useAuth();
  const location = useLocation();
  const pathname = location.pathname;

  if (user?.page_visibility) {
    const pageKey = resolvePageKey(pathname);
    if (pageKey && user.page_visibility[pageKey] === false) {
      return <Navigate to="/" replace />;
    }
  }

  return <Outlet />;
}

export { USER_PAGE_KEYS };

import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { USER_PAGE_KEYS, type UserPageKey } from '../types/auth';

const PATH_TO_PAGE_KEY: Record<string, UserPageKey> = {
  '/': 'dashboard',
  '/organisatie': 'organisatie',
  '/brands': 'brands',
  '/automontage': 'automontage',
  '/werkzaamheden': 'werkzaamheden',
  '/onderdelen': 'onderdelen',
};

export default function PageVisibilityGuard() {
  const { user } = useAuth();
  const location = useLocation();
  const pathname = location.pathname;

  if (user?.page_visibility) {
    const pageKey = PATH_TO_PAGE_KEY[pathname];
    if (pageKey && user.page_visibility[pageKey] === false) {
      return <Navigate to="/" replace />;
    }
  }

  return <Outlet />;
}

export { USER_PAGE_KEYS };

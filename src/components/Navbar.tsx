import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Building2,
  Tag,
  Car,
  Wrench,
  ClipboardList,
  Box,
  Users,
  History,
  Menu,
  X,
  User,
  LogOut,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import './Navbar.css';

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement | null>(null);
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!userMenuOpen) {
      return undefined;
    }

    function handlePointerDown(event: MouseEvent) {
      if (!userMenuRef.current?.contains(event.target as Node)) {
        setUserMenuOpen(false);
      }
    }

    document.addEventListener('mousedown', handlePointerDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
    };
  }, [userMenuOpen]);

  async function handleLogout() {
    setUserMenuOpen(false);
    setMenuOpen(false);
    await signOut();
    navigate('/login');
  }

  return (
    <nav className="navbar">
      <div className="navbar-inner">
        <Link to="/" className="navbar-home" aria-label="Home">
          <img src="/tb-w.svg" alt="Home" className="navbar-home-logo" />
        </Link>
        <div className="navbar-links">
          <Link to="/" className="navbar-link navbar-link-dashboard">
            <LayoutDashboard size={20} />
            Dashboard
          </Link>
          <Link to="/automontage" className="navbar-link">
            <Car size={20} />
            Voertuigbeheer
          </Link>
          <Link to="/werkzaamheden" className="navbar-link">
            <ClipboardList size={20} />
            Werkzaamheden
          </Link>
          <Link to="/reparaties" className="navbar-link">
            <Wrench size={20} />
            Reparaties
          </Link>
          <div className="navbar-hamburger-wrap">
            <button
              type="button"
              className="navbar-hamburger"
              onClick={() => setMenuOpen((o) => !o)}
              aria-expanded={menuOpen}
              aria-label={menuOpen ? 'Menu sluiten' : 'Menu openen'}
            >
              {menuOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
            {menuOpen && (
              <>
                <div
                  className="navbar-overlay"
                  onClick={() => setMenuOpen(false)}
                  aria-hidden="true"
                />
                <div className="navbar-dropdown">
                  <Link
                    to="/organisatie"
                    className="navbar-dropdown-link"
                    onClick={() => setMenuOpen(false)}
                  >
                    <Building2 size={20} />
                    Organisatie
                  </Link>
                  <Link
                    to="/brands"
                    className="navbar-dropdown-link"
                    onClick={() => setMenuOpen(false)}
                  >
                    <Tag size={20} />
                    Merken
                  </Link>
                  <Link
                    to="/medewerkers"
                    className="navbar-dropdown-link"
                    onClick={() => setMenuOpen(false)}
                  >
                    <Users size={20} />
                    Medewerkers
                  </Link>
                  <Link
                    to="/onderdelen"
                    className="navbar-dropdown-link"
                    onClick={() => setMenuOpen(false)}
                  >
                    <Box size={20} />
                    Onderdelen
                  </Link>
                </div>
              </>
            )}
          </div>
          {user && (
            <div className="navbar-auth">
              <div className="navbar-user-menu-wrap" ref={userMenuRef}>
                <button
                  type="button"
                  className="navbar-link navbar-user-menu-btn"
                  title={user.username}
                  onClick={() => setUserMenuOpen((open) => !open)}
                  aria-expanded={userMenuOpen}
                  aria-label={userMenuOpen ? 'Gebruikersmenu sluiten' : 'Gebruikersmenu openen'}
                >
                  <User size={20} />
                  {user.username}
                </button>
                {userMenuOpen && (
                  <div className="navbar-user-menu">
                    {user.role === 'admin' && (
                      <>
                        <Link to="/user-management" className="navbar-user-menu-item" onClick={() => setUserMenuOpen(false)}>
                          <User size={18} />
                          User Management
                        </Link>
                        <Link to="/users-log" className="navbar-user-menu-item" onClick={() => setUserMenuOpen(false)}>
                          <User size={18} />
                          Users Log
                        </Link>
                        <Link to="/activity-log" className="navbar-user-menu-item" onClick={() => setUserMenuOpen(false)}>
                          <History size={18} />
                          Activity Log
                        </Link>
                      </>
                    )}
                    <Link to="/profile" className="navbar-user-menu-item" onClick={() => setUserMenuOpen(false)}>
                      <User size={18} />
                      Mijn profiel
                    </Link>
                    <button type="button" className="navbar-user-menu-item navbar-dropdown-btn" onClick={handleLogout}>
                      <LogOut size={18} />
                      Uitloggen
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}

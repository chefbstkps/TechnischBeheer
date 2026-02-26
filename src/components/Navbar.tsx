import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Home,
  LayoutDashboard,
  Building2,
  Tag,
  Car,
  Wrench,
  Box,
  Menu,
  X,
  User,
  LogOut,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import './Navbar.css';

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await signOut();
    navigate('/login');
  }

  return (
    <nav className="navbar">
      <div className="navbar-inner">
        <Link to="/" className="navbar-home" aria-label="Home">
          <Home size={24} />
        </Link>
        <div className="navbar-links">
          <Link to="/" className="navbar-link">
            <LayoutDashboard size={20} />
            Dashboard
          </Link>
          <Link to="/automontage" className="navbar-link">
            <Car size={20} />
            Voertuigbeheer
          </Link>
          <Link to="/werkzaamheden" className="navbar-link">
            <Wrench size={20} />
            Werkzaamheden
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
                    to="/onderdelen"
                    className="navbar-dropdown-link"
                    onClick={() => setMenuOpen(false)}
                  >
                    <Box size={20} />
                    Onderdelen
                  </Link>
                  {user && (
                    <>
                      <Link
                        to="/profile"
                        className="navbar-dropdown-link"
                        onClick={() => setMenuOpen(false)}
                      >
                        <User size={20} />
                        Mijn profiel
                      </Link>
                      <button
                        type="button"
                        className="navbar-dropdown-link navbar-dropdown-btn"
                        onClick={() => {
                          setMenuOpen(false);
                          handleLogout();
                        }}
                      >
                        <LogOut size={20} />
                        Uitloggen
                      </button>
                    </>
                  )}
                </div>
              </>
            )}
          </div>
          {user && (
            <div className="navbar-auth">
              <Link to="/profile" className="navbar-link" title={user.username}>
                <User size={20} />
                {user.username}
              </Link>
              <button
                type="button"
                className="navbar-link navbar-logout"
                onClick={handleLogout}
                title="Uitloggen"
              >
                <LogOut size={20} />
                Uitloggen
              </button>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}

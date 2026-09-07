// ---------------------------------------------------------------------
//  src/components/navbar.tsx
//
//  Változások:
//   - nincs isAdmin / onLogout prop: a useAuth() hookból jön
//   - a kijelentkezés ténylegesen érvényteleníti a Supabase-tokent
//     (a régi verzió csak a localStorage-ot ürítette, a szerveroldali
//     session életben maradt)
//   - a logó neve már nem "F1 STATS" — az F1 saját irányelve szerint a
//     védjegy nem használható a weboldal márkázására
// ---------------------------------------------------------------------
import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTheme } from "./ThemeContext";
import { useAuth } from "../AuthContext";
import { SITE_NAME } from "../config";

const LINKS = [
  { to: "/", label: "Kezdőlap" },
  { to: "/statistics", label: "Statisztikák" },
  { to: "/grand_prix", label: "Nagydíjak" },
  { to: "/driver", label: "Versenyzők" },
  { to: "/constructor", label: "Csapatok" },
  { to: "/circuit", label: "Pályák" },
];

const Navbar: React.FC = () => {
  const { theme, toggleTheme } = useTheme();
  const { isAdmin, session, signOut } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await signOut();
    } finally {
      navigate("/login");
    }
  };

  return (
    <nav className="navbar">
      <div className="navbar-container">
        <Link to="/" className="navbar-logo">
          {SITE_NAME}
        </Link>

        <div className="navbar-links">
          {LINKS.map((l) => (
            <Link key={l.to} to={l.to} className="navbar-link">
              {l.label}
            </Link>
          ))}

         {isAdmin && (
  <>
    <Link
      to="/admin/drivers"
      className="navbar-link navbar-link--admin"
      title="Adminisztráció"
    >
      ⚙
    </Link>
    <Link
      to="/admin/sync"
      className="navbar-link navbar-link--admin"
      title="Adatszinkron"
    >
      ⟳
    </Link>
  </>
)}

          {session ? (
            <button
              type="button"
              className="navbar-link navbar-button"
              onClick={handleLogout}
            >
              Kijelentkezés
            </button>
          ) : (
            <Link to="/login" className="navbar-link">
              Bejelentkezés
            </Link>
          )}

          <button
            type="button"
            className="theme-toggle"
            onClick={toggleTheme}
            aria-label={theme === "dark" ? "Világos mód" : "Sötét mód"}
          >
            {theme === "dark" ? "☀" : "☾"}
          </button>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;

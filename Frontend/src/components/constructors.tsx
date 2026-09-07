// ---------------------------------------------------------------------
//  src/pages/constructors.tsx
//
//  A fix 5 oszlopos rács helyett auto-fit rács (javitando_funkciok.md #32:
//  a régi verzió mobilon összenyomódott, a záródolgozat tesztmátrixa is
//  "Részben" eredménnyel jelezte).
// ---------------------------------------------------------------------
import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api, { teamGradient } from "../api";
import type { Constructor } from "../database.types";
import { useAuth } from "../AuthContext";
import "../styles/constructor.css";

const ConstructorPage: React.FC = () => {
  const [constructors, setConstructors] = useState<Constructor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { isAdmin } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    let active = true;
    api.constructors
      .list()
      .then((c) => active && setConstructors(c))
      .catch((e) => active && setError(e instanceof Error ? e.message : "Hiba"))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  if (loading) return <div className="loading">Betöltés…</div>;
  if (error) return <div className="error">{error}</div>;

  return (
    <div className="constructor-page">
      <div className="constructor-header">
        <h1>Csapatok</h1>
        {isAdmin && (
          <Link to="/admin/constructors" className="admin-add-btn">
            + Csapatok kezelése
          </Link>
        )}
      </div>

      <div
        className="constructor-grid"
        /* auto-fit: asztali nézetben 5 oszlop, mobilon 1-2 — media query nélkül */
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: "1rem",
        }}
      >
        {constructors.map((c) => (
          <div
            key={c.ConstructorID}
            className="constructor-card"
            role="button"
            tabIndex={0}
            onClick={() => navigate(`/constructor/${c.ConstructorID}`)}
            onKeyDown={(e) =>
              e.key === "Enter" && navigate(`/constructor/${c.ConstructorID}`)
            }
            style={{ background: teamGradient(c.TeamColour) }}
          >
            <div className="constructor-top">
              {c.Image ? (
                <img
                  src={c.Image}
                  alt={c.Name}
                  className="constructor-logo"
                  loading="lazy"
                />
              ) : (
                <span
                  className="constructor-logo"
                  style={{
                    display: "grid",
                    placeItems: "center",
                    fontWeight: 900,
                    fontSize: "1.4rem",
                    border: "3px solid #000",
                    borderRadius: 8,
                    minHeight: 56,
                  }}
                >
                  {c.Name.slice(0, 3).toUpperCase()}
                </span>
              )}
              <span className="constructor-name">{c.Name}</span>
            </div>

            <div className="constructor-details">
              <span className="constructor-nationality">
                {c.Nationality ?? "—"}
              </span>
              <span className="constructor-info">
                {c.FoundedYear ? `Alapítva: ${c.FoundedYear}` : ""}
                {c.TeamPrincipal ? ` · ${c.TeamPrincipal}` : ""}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ConstructorPage;

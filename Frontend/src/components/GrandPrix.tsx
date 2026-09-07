// ---------------------------------------------------------------------
//  src/pages/grand_prix.tsx
//
//  Új: szezonválasztó. A séma UNIQUE (Name, Year) kulcsa ezt már engedi —
//  a régi séma globálisan egyedi Name mezője miatt egy szezon fért csak be
//  (javitando_funkciok.md #20).
// ---------------------------------------------------------------------
import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../api";
import type { GrandPrix } from "../database.types";
import { useAuth } from "../AuthContext";
import "../Styles/grandprix.css";

/** Az ország zászlószíneit a hover-effekthez a CSS oldja meg
 *  (.grandprix-row[data-country="Hungary"] stb.). */
const GrandPrixPage: React.FC = () => {
  const [races, setRaces] = useState<GrandPrix[]>([]);
  const [seasons, setSeasons] = useState<number[]>([]);
  const [year, setYear] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { isAdmin } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    let active = true;
    api.grandPrix
      .seasons()
      .then((s) => {
        if (!active) return;
        setSeasons(s);
        setYear(s[0] ?? null);
      })
      .catch(
        (e) => active && setError(e instanceof Error ? e.message : "Hiba"),
      );
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (year === null) return;
    let active = true;
    setLoading(true);
    api.grandPrix
      .list(year)
      .then((r) => active && setRaces(r))
      .catch((e) => active && setError(e instanceof Error ? e.message : "Hiba"))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [year]);

  if (error) return <div className="error">{error}</div>;

  return (
    <div className="grandprix-page">
      <div className="grandprix-header">
        <h1>Nagydíjak</h1>

        <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
          {seasons.length > 1 && (
            <select
              value={year ?? ""}
              onChange={(e) => setYear(Number(e.target.value))}
              aria-label="Szezon"
            >
              {seasons.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          )}

          {isAdmin && (
            <Link to="/admin/grandprix" className="admin-add-btn">
              + Nagydíjak kezelése
            </Link>
          )}
        </div>
      </div>

      {loading ? (
        <div className="loading">Betöltés…</div>
      ) : (
        <div className="grandprix-list">
          {races.map((gp) => (
            <div
              key={gp.GrandPrixID}
              className="grandprix-row"
              data-country={gp.Country ?? ""}
              role="button"
              tabIndex={0}
              onClick={() => navigate(`/grandprix/${gp.GrandPrixID}`)}
              onKeyDown={(e) =>
                e.key === "Enter" && navigate(`/grandprix/${gp.GrandPrixID}`)
              }
            >
              {gp.Round != null && <span className="gp-year">{gp.Round}.</span>}
              <span className="gp-name">{gp.Name}</span>
              <span className="gp-country">{gp.Country ?? "—"}</span>
              <span className="gp-year">{gp.RaceDate ?? gp.Year}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default GrandPrixPage;

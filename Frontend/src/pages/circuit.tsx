// ---------------------------------------------------------------------
//  src/pages/circuit.tsx
//
//  A RecordLapTime most INTERVAL, ezért a formatLapTime() segédfüggvény
//  formázza. A régi MySQL TIME oszlop az 01:31.447 értéket 1 óra 31 percként
//  tárolta (javitando_funkciok.md #17).
// ---------------------------------------------------------------------
import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api, { formatLapTime } from "../lib/api";
import type { Circuit } from "../lib/database.types";
import { useAuth } from "../lib/AuthContext";
import "../styles/circuit.css";

const CircuitPage: React.FC = () => {
  const [circuits, setCircuits] = useState<Circuit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { isAdmin } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    let active = true;
    api.circuits
      .list()
      .then((c) => active && setCircuits(c))
      .catch((e) => active && setError(e instanceof Error ? e.message : "Hiba"))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  if (loading) return <div className="loading">Betöltés…</div>;
  if (error) return <div className="error">{error}</div>;

  return (
    <div className="circuit-page">
      <div className="circuit-header">
        <h1>Versenypályák</h1>
        {isAdmin && (
          <Link to="/admin/circuits" className="admin-add-btn">
            + Pályák kezelése
          </Link>
        )}
      </div>

      <div className="circuits-grid">
        {circuits.map((c) => (
          <div
            key={c.CircuitID}
            className="circuit-card"
            role="button"
            tabIndex={0}
            onClick={() => navigate(`/circuit/${c.CircuitID}`)}
            onKeyDown={(e) => e.key === "Enter" && navigate(`/circuit/${c.CircuitID}`)}
          >
            <div className="circuit-top">
              <div>
                <div className="circuit-name">{c.Name}</div>
                <div className="circuit-location">
                  {[c.Location, c.Country].filter(Boolean).join(", ") || "—"}
                </div>
              </div>
              {c.Image && (
                <div className="circuit-image-wrap">
                  <img src={c.Image} alt={`${c.Name} pályarajz`} loading="lazy" />
                </div>
              )}
            </div>

            <div className="circuit-stats-grid">
              <div className="stat-box">
                <strong>{c.Length ? `${c.Length} km` : "—"}</strong>
                <span>Hossz</span>
              </div>
              <div className="stat-box">
                <strong>{c.Laps ?? "—"}</strong>
                <span>Körök</span>
              </div>
              <div className="stat-box">
                <strong>{c.FirstGrandPrix ?? "—"}</strong>
                <span>Első GP</span>
              </div>
              <div className="stat-box">
                <strong>{formatLapTime(c.RecordLapTime)}</strong>
                <span>Körrekord</span>
              </div>
            </div>

            {c.RecordDriver && (
              <div className="circuit-location">Rekorder: {c.RecordDriver}</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default CircuitPage;
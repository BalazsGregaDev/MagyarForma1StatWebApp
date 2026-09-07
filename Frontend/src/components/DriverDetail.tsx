// ---------------------------------------------------------------------
//  src/pages/detailPages/circuitDetail.tsx
// ---------------------------------------------------------------------
import React, { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import api, { formatLapTime } from "../api";
import type { Circuit, GrandPrix } from "../database.types";
import "../Styles/circuit.css";

type CircuitWithRaces = Circuit & { grandprix: GrandPrix[] };

const CircuitDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [circuit, setCircuit] = useState<CircuitWithRaces | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let active = true;
    api.circuits
      .getWithRaces(Number(id))
      .then((c) => active && setCircuit(c))
      .catch((e) => active && setError(e instanceof Error ? e.message : "Hiba"))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [id]);

  if (loading) return <div className="loading">Betöltés…</div>;
  if (error) return <div className="error">{error}</div>;
  if (!circuit) return <div className="error">A pálya nem található.</div>;

  const races = [...circuit.grandprix].sort((a, b) => b.Year - a.Year);

  return (
    <div className="driver-detail-page">
      <button type="button" className="detail-back-btn" onClick={() => navigate(-1)}>
        ← Vissza
      </button>

      <div className="circuit-hero">
        <div className="circuit-hero-overlay" />
        <div className="circuit-hero-content">
          <div className="circuit-hero-info">
            <h1 className="circuit-hero-name">{circuit.Name}</h1>
            <div className="circuit-hero-nation">
              {[circuit.Location, circuit.Country].filter(Boolean).join(", ") || "—"}
            </div>
          </div>

          {circuit.Image && (
            <div className="circuit-hero-image-wrap">
              <img
                src={circuit.Image}
                alt={`${circuit.Name} pályarajz`}
                className="circuit-hero-image"
                loading="lazy"
              />
            </div>
          )}
        </div>
      </div>

      <div className="driver-detail-stats">
        <div className="driver-detail-card">
          <span className="driver-detail-label">Hossz</span>
          <span className="driver-detail-value">
            {circuit.Length ? `${circuit.Length} km` : "—"}
          </span>
        </div>
        <div className="driver-detail-card">
          <span className="driver-detail-label">Körök</span>
          <span className="driver-detail-value">{circuit.Laps ?? "—"}</span>
        </div>
        <div className="driver-detail-card">
          <span className="driver-detail-label">Első Grand Prix</span>
          <span className="driver-detail-value">{circuit.FirstGrandPrix ?? "—"}</span>
        </div>
        <div className="driver-detail-card">
          <span className="driver-detail-label">Körrekord</span>
          <span className="driver-detail-value">{formatLapTime(circuit.RecordLapTime)}</span>
        </div>
        <div className="driver-detail-card">
          <span className="driver-detail-label">Rekorder</span>
          <span className="driver-detail-value">{circuit.RecordDriver ?? "—"}</span>
        </div>
        <div className="driver-detail-card">
          <span className="driver-detail-label">Futamok</span>
          <span className="driver-detail-value">{races.length}</span>
        </div>
      </div>

      <h2>Itt rendezett futamok</h2>
      <div className="constructor-drivers-grid">
        {races.map((gp) => (
          <Link
            key={gp.GrandPrixID}
            to={`/grandprix/${gp.GrandPrixID}`}
            className="constructor-driver-card"
          >
            <div className="constructor-driver-info">
              <span className="constructor-driver-name">{gp.Name}</span>
              <span className="gp-detail-year">{gp.Year}</span>
            </div>
          </Link>
        ))}
      </div>

      {circuit.Image && circuit.image_author && (
        <small style={{ opacity: 0.6, display: "block", marginTop: "1rem" }}>
          Pályarajz: {circuit.image_author}
          {circuit.image_license ? ` (${circuit.image_license})` : ""}
        </small>
      )}
    </div>
  );
};

export default CircuitDetailPage;
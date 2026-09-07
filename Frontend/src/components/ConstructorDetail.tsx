// ---------------------------------------------------------------------
//  src/pages/detailPages/constructorDetail.tsx
// ---------------------------------------------------------------------
import React, { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import api, { teamGradient } from "../api";
import type {
  Constructor,
  Driver,
  ConstructorStatsResult,
} from "../database.types";
import DriverAvatar from "../components/DriverAvatar";
import "../Styles/constructor.css";

type TeamWithDrivers = Constructor & { drivers: Driver[] };

const ConstructorDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [team, setTeam] = useState<TeamWithDrivers | null>(null);
  const [stats, setStats] = useState<ConstructorStatsResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let active = true;
    setLoading(true);

    api.constructors
      .getWithDrivers(Number(id))
      .then((t) => {
        if (!active) return;
        setTeam(t);
        return api.statistics
          .constructor(Number(id))
          .then((s) => active && setStats(s));
      })
      .catch((e) => active && setError(e instanceof Error ? e.message : "Hiba"))
      .finally(() => active && setLoading(false));

    return () => {
      active = false;
    };
  }, [id]);

  if (loading) return <div className="loading">Betöltés…</div>;
  if (error) return <div className="error">{error}</div>;
  if (!team) return <div className="error">A csapat nem található.</div>;

  return (
    <div className="driver-detail-page">
      <button type="button" className="detail-back-btn" onClick={() => navigate(-1)}>
        ← Vissza
      </button>

      <div className="gp-detail-hero" style={{ background: teamGradient(team.TeamColour) }}>
        {team.Image && (
          <div className="constructor-logo-box">
            <img src={team.Image} alt={team.Name} loading="lazy" />
          </div>
        )}
        <div className="gp-detail-info">
          <h1 className="gp-detail-name">{team.Name}</h1>
          <div className="gp-detail-country">{team.Nationality ?? "—"}</div>
          {team.FoundedYear && <div className="gp-detail-year">Alapítva: {team.FoundedYear}</div>}
        </div>
      </div>

      <div className="driver-detail-stats">
        <div className="driver-detail-card">
          <span className="driver-detail-label">VB-címek</span>
          <span className="driver-detail-value">{team.WorldChampionships}</span>
        </div>
        <div className="driver-detail-card">
          <span className="driver-detail-label">Győzelmek (összes)</span>
          <span className="driver-detail-value">{team.Wins}</span>
        </div>
        <div className="driver-detail-card">
          <span className="driver-detail-label">Pole pozíciók</span>
          <span className="driver-detail-value">{team.PolePositions}</span>
        </div>
        <div className="driver-detail-card">
          <span className="driver-detail-label">Dobogók (összes)</span>
          <span className="driver-detail-value">{team.Podiums}</span>
        </div>
        <div className="driver-detail-card">
          <span className="driver-detail-label">Csapatfőnök</span>
          <span className="driver-detail-value">{team.TeamPrincipal ?? "—"}</span>
        </div>
        <div className="driver-detail-card">
          <span className="driver-detail-label">Szezonpont</span>
          <span className="driver-detail-value">
            {stats?.constructor ? Number(stats.constructor.points) : "—"}
          </span>
        </div>
      </div>

      {team.History && <p className="driver-detail-bio">{team.History}</p>}

      <h2>Versenyzők</h2>
      <div className="constructor-drivers-grid">
        {team.drivers.map((d) => (
          <Link
            key={d.DriverID}
            to={`/driver/${d.DriverID}`}
            className="constructor-driver-card"
            style={{ background: teamGradient(team.TeamColour) }}
          >
            <div className="constructor-driver-image">
              <DriverAvatar
                name={d.Name}
                number={d.DriverNumber}
                acronym={d.Acronym}
                teamColour={team.TeamColour}
                image={d.Image || null}
                size={90}
              />
            </div>
            <div className="constructor-driver-info">
              <span className="constructor-driver-name">{d.Name}</span>
              <span className="constructor-driver-nationality">{d.Nationality ?? "—"}</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
};

export default ConstructorDetailPage;
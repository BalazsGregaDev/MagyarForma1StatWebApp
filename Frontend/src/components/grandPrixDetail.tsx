// ---------------------------------------------------------------------
//  src/pages/detailPages/grandPrixDetail.tsx
//
//  A régi verzió három külön fetch-et indított (futam, pálya, győztes).
//  Most egy joinolt lekérdezés + egy az eredménylistára.
//
//  Új: teljes eredménytáblázat, és sprint/futam kapcsoló, ha volt sprint.
// ---------------------------------------------------------------------
import React, { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import api, { teamGradient } from "../../lib/api";
import type {
  GrandPrix,
  Circuit,
  Driver,
  Constructor,
  RaceResult,
} from "../../lib/database.types";
import DriverAvatar from "../../components/DriverAvatar";
import "../../styles/grandprix.css";

type FullGP = GrandPrix & { circuit: Circuit | null; winner: Driver | null };
type ResultRow = RaceResult & { driver: Driver; constructor: Constructor };

const GrandPrixDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [gp, setGp] = useState<FullGP | null>(null);
  const [results, setResults] = useState<ResultRow[]>([]);
  const [sprintResults, setSprintResults] = useState<ResultRow[]>([]);
  const [view, setView] = useState<"race" | "sprint">("race");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let active = true;
    const n = Number(id);

    Promise.all([
      api.grandPrix.getFull(n),
      api.grandPrix.results(n, false),
      api.grandPrix.results(n, true),
    ])
      .then(([g, r, s]) => {
        if (!active) return;
        setGp(g);
        setResults(r as ResultRow[]);
        setSprintResults(s as ResultRow[]);
      })
      .catch((e) => active && setError(e instanceof Error ? e.message : "Hiba"))
      .finally(() => active && setLoading(false));

    return () => {
      active = false;
    };
  }, [id]);

  if (loading) return <div className="loading">Betöltés…</div>;
  if (error) return <div className="error">{error}</div>;
  if (!gp) return <div className="error">A futam nem található.</div>;

  const rows = view === "race" ? results : sprintResults;
  const winnerColour =
    results.find((r) => r.Position === 1)?.constructor?.TeamColour ?? null;

  return (
    <div className="driver-detail-page">
      <button type="button" className="detail-back-btn" onClick={() => navigate(-1)}>
        ← Vissza
      </button>

      <div className="gp-detail-hero" style={{ background: teamGradient(winnerColour) }}>
        <div className="gp-detail-info">
          <h1 className="gp-detail-name">{gp.Name}</h1>
          <div className="gp-detail-country">{gp.Country ?? "—"}</div>
          <div className="gp-detail-year">
            {gp.RaceDate ?? gp.Year}
            {gp.Round != null && ` · ${gp.Round}. forduló`}
          </div>
        </div>

        {gp.circuit?.Image && (
          <img
            src={gp.circuit.Image}
            alt={gp.circuit.Name}
            className="gp-detail-circuit-image"
            loading="lazy"
          />
        )}
      </div>

      <div className="driver-detail-stats">
        <div className="driver-detail-card">
          <span className="driver-detail-label">Pálya</span>
          <span className="driver-detail-value">
            {gp.circuit ? (
              <Link to={`/circuit/${gp.circuit.CircuitID}`}>{gp.circuit.Name}</Link>
            ) : (
              "—"
            )}
          </span>
        </div>
        <div className="driver-detail-card">
          <span className="driver-detail-label">Győztes</span>
          <span className="driver-detail-value">
            {gp.winner ? (
              <Link to={`/driver/${gp.winner.DriverID}`}>{gp.winner.Name}</Link>
            ) : (
              "—"
            )}
          </span>
        </div>
        <div className="driver-detail-card">
          <span className="driver-detail-label">Körök</span>
          <span className="driver-detail-value">{gp.circuit?.Laps ?? "—"}</span>
        </div>
      </div>

      {sprintResults.length > 0 && (
        <div className="stats-tabs">
          <button
            type="button"
            className={view === "race" ? "stats-tab active" : "stats-tab"}
            onClick={() => setView("race")}
          >
            Futam
          </button>
          <button
            type="button"
            className={view === "sprint" ? "stats-tab active" : "stats-tab"}
            onClick={() => setView("sprint")}
          >
            Sprint
          </button>
        </div>
      )}

      <h2>{view === "race" ? "Futameredmény" : "Sprinteredmény"}</h2>

      {rows.length === 0 ? (
        <p>Ehhez a futamhoz még nincs rögzített eredmény.</p>
      ) : (
        <table className="standings-table">
          <thead>
            <tr>
              <th>Poz.</th>
              <th></th>
              <th>Versenyző</th>
              <th>Csapat</th>
              <th>Rajthely</th>
              <th>Kör</th>
              <th>Idő / kiesés</th>
              <th>Pont</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.ResultID}>
                <td>{r.Position ?? "DNF"}</td>
                <td>
                  <DriverAvatar
                    name={r.driver.Name}
                    number={r.driver.DriverNumber}
                    acronym={r.driver.Acronym}
                    teamColour={r.constructor?.TeamColour ?? null}
                    image={r.driver.Image || null}
                    size={34}
                  />
                </td>
                <td>
                  <Link to={`/driver/${r.DriverID}`}>{r.driver.Name}</Link>
                  {r.FastestLap && <span title="Leggyorsabb kör"> ⏱</span>}
                </td>
                <td>
                  <Link to={`/constructor/${r.ConstructorID}`}>{r.constructor.Name}</Link>
                </td>
                <td>{r.Grid ?? "—"}</td>
                <td>{r.Laps ?? "—"}</td>
                <td>{r.TimeOrRetired ?? "—"}</td>
                <td className="points-cell">{Number(r.Points)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default GrandPrixDetailPage;
// ---------------------------------------------------------------------
//  src/pages/statistics.tsx
//
//  A régi verzió 7 külön fetch-et indított a StatisticsController felé.
//  Most: két nézet-lekérdezés (v_driver_standings / v_constructor_standings)
//  és egy RPC a részletes nézethez.
//
//  A LÉNYEG: az aggregáció adatbázis-oldalon fut, a nézetekben szereplő
//  FILTER (WHERE "GpOrSprint") záradékkal — ez javítja a régi hibát, ahol
//  a sprintgyőzelmek is futamgyőzelemnek számítottak (Verstappen 13 vs 9).
// ---------------------------------------------------------------------
import React, { useCallback, useEffect, useState } from "react";
import api, { teamGradient } from "../api";
import type {
  DriverStanding,
  ConstructorStanding,
  DriverStatsResult,
  ConstructorStatsResult,
} from "../database.types";
import DriverAvatar from "../components/DriverAvatar";
import "../Styles/statistics.css";

type Tab = "drivers" | "constructors";

const StatisticsPage: React.FC = () => {
  const [tab, setTab] = useState<Tab>("drivers");
  const [driverStandings, setDriverStandings] = useState<DriverStanding[]>([]);
  const [constructorStandings, setConstructorStandings] = useState<
    ConstructorStanding[]
  >([]);

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [driverStats, setDriverStats] = useState<DriverStatsResult | null>(
    null,
  );
  const [constructorStats, setConstructorStats] =
    useState<ConstructorStatsResult | null>(null);

  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // --- Tabellák betöltése -------------------------------------------
  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([
      api.statistics.driverStandings(),
      api.statistics.constructorStandings(),
    ])
      .then(([d, c]) => {
        if (!active) return;
        setDriverStandings(d);
        setConstructorStandings(c);
      })
      .catch((e) => active && setError(e instanceof Error ? e.message : "Hiba"))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  // --- Részletes statisztika ----------------------------------------
  const select = useCallback(
    async (id: number) => {
      setSelectedId(id);
      setStatsLoading(true);
      setError(null);
      try {
        if (tab === "drivers") {
          setDriverStats(await api.statistics.driver(id));
          setConstructorStats(null);
        } else {
          setConstructorStats(await api.statistics.constructor(id));
          setDriverStats(null);
        }
      } catch (e) {
        setError(
          e instanceof Error
            ? e.message
            : "A statisztika betöltése nem sikerült.",
        );
      } finally {
        setStatsLoading(false);
      }
    },
    [tab],
  );

  const switchTab = (next: Tab) => {
    setTab(next);
    setSelectedId(null);
    setDriverStats(null);
    setConstructorStats(null);
  };

  const backToStandings = () => {
    setSelectedId(null);
    setDriverStats(null);
    setConstructorStats(null);
  };

  const stats =
    tab === "drivers" ? driverStats?.driver : constructorStats?.constructor;
  const chart =
    tab === "drivers"
      ? driverStats?.points_chart
      : constructorStats?.points_chart;
  const maxPoints = Math.max(1, ...(chart ?? []).map((c) => Number(c.points)));

  if (loading) return <div className="page-state">Betöltés…</div>;

  return (
    <div className="stats-page">
      <div className="stats-tabs">
        <button
          type="button"
          className={tab === "drivers" ? "stats-tab active" : "stats-tab"}
          onClick={() => switchTab("drivers")}
        >
          Versenyzők
        </button>
        <button
          type="button"
          className={tab === "constructors" ? "stats-tab active" : "stats-tab"}
          onClick={() => switchTab("constructors")}
        >
          Csapatok
        </button>
      </div>

      {error && (
        <div className="admin-error" role="alert">
          {error}
        </div>
      )}

      {selectedId === null ? (
        /* ---------------- Bajnoki tabella ---------------- */
        <table className="standings-table">
          <thead>
            <tr>
              <th>#</th>
              <th></th>
              <th>{tab === "drivers" ? "Versenyző" : "Csapat"}</th>
              {tab === "drivers" && <th>Csapat</th>}
              <th>Győzelem</th>
              <th>Dobogó</th>
              <th>Pont</th>
            </tr>
          </thead>
          <tbody>
            {tab === "drivers"
              ? driverStandings.map((d, i) => (
                  <tr
                    key={d.DriverID}
                    onClick={() => select(d.DriverID)}
                    className="clickable"
                  >
                    <td>{i + 1}</td>
                    <td>
                      <DriverAvatar
                        name={d.driver_name}
                        number={d.DriverNumber}
                        acronym={d.Acronym}
                        teamColour={d.team_colour}
                        image={d.Image || null}
                        size={36}
                      />
                    </td>
                    <td>{d.driver_name}</td>
                    <td>{d.constructor_name ?? "—"}</td>
                    <td>{d.wins}</td>
                    <td>{d.podiums}</td>
                    <td className="points-cell">{Number(d.points)}</td>
                  </tr>
                ))
              : constructorStandings.map((c, i) => (
                  <tr
                    key={c.ConstructorID}
                    onClick={() => select(c.ConstructorID)}
                    className="clickable"
                  >
                    <td>{i + 1}</td>
                    <td>
                      <span
                        className="team-swatch"
                        style={{ background: teamGradient(c.team_colour) }}
                      />
                    </td>
                    <td>{c.constructor_name}</td>
                    <td>{c.wins}</td>
                    <td>{c.podiums}</td>
                    <td className="points-cell">{Number(c.points)}</td>
                  </tr>
                ))}
          </tbody>
        </table>
      ) : (
        /* ---------------- Részletes nézet ---------------- */
        <div className="stats-detail">
          <button type="button" className="btn" onClick={backToStandings}>
            ← Vissza a tabellához
          </button>

          {statsLoading || !stats ? (
            <div className="page-state">Betöltés…</div>
          ) : (
            <>
              <header
                className="stats-hero"
                style={{ background: teamGradient(stats.team_colour) }}
              >
                <h1>
                  {tab === "drivers"
                    ? (stats as DriverStanding).driver_name
                    : (stats as ConstructorStanding).constructor_name}
                </h1>
              </header>

              <div className="stats-cards">
                <div className="stat-card">
                  <span className="stat-value">{Number(stats.points)}</span>
                  <span className="stat-label">Pont</span>
                </div>
                <div className="stat-card">
                  <span className="stat-value">{stats.wins}</span>
                  <span className="stat-label">Futamgyőzelem</span>
                </div>
                <div className="stat-card">
                  <span className="stat-value">{stats.podiums}</span>
                  <span className="stat-label">Dobogó</span>
                </div>
                <div className="stat-card">
                  <span className="stat-value">{stats.fastest_laps}</span>
                  <span className="stat-label">Leggyorsabb kör</span>
                </div>
                <div className="stat-card">
                  <span className="stat-value">{stats.races}</span>
                  <span className="stat-label">Futam</span>
                </div>
                <div className="stat-card">
                  <span className="stat-value">
                    {stats.races > 0
                      ? (Number(stats.points) / stats.races).toFixed(1)
                      : "0.0"}
                  </span>
                  <span className="stat-label">Átlagpont / futam</span>
                </div>
              </div>

              <div className="points-chart">
                {(chart ?? []).map((c) => (
                  <div
                    key={c.GrandPrixID}
                    className="chart-column"
                    title={c.grand_prix_name}
                  >
                    <div
                      className="chart-bar"
                      style={{
                        height: `${(Number(c.points) / maxPoints) * 100}%`,
                        background: teamGradient(stats.team_colour),
                      }}
                    />
                    <span className="chart-value">{Number(c.points)}</span>
                    <span className="chart-label">
                      {(c.Country ?? c.grand_prix_name)
                        .slice(0, 3)
                        .toUpperCase()}
                    </span>
                  </div>
                ))}
              </div>

              {tab === "constructors" && constructorStats && (
                <div className="team-drivers">
                  <h2>Versenyzők</h2>
                  <div className="driver-chips">
                    {constructorStats.drivers.map((d) => (
                      <div key={d.DriverID} className="driver-chip">
                        <DriverAvatar
                          name={d.driver_name}
                          number={d.DriverNumber}
                          acronym={d.Acronym}
                          teamColour={d.team_colour}
                          image={d.Image || null}
                          size={40}
                        />
                        <span>{d.driver_name}</span>
                        <strong>{Number(d.points)}</strong>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default StatisticsPage;

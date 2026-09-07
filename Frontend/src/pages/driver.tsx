// ---------------------------------------------------------------------
//  src/pages/driver.tsx
//
//  Változás: fetch -> api.drivers.list(), isAdmin prop -> useAuth().
//  A csapatszínek a constructors.TeamColour oszlopból jönnek, nem a
//  hardkódolt constructorColors objektumból.
// ---------------------------------------------------------------------
import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api, { teamGradient } from "../lib/api";
import type { Driver, Constructor } from "../lib/database.types";
import { useAuth } from "../lib/AuthContext";
import DriverAvatar from "../components/DriverAvatar";
import "../styles/driver.css";

const DriversPage: React.FC = () => {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [teams, setTeams] = useState<Constructor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { isAdmin } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    let active = true;
    Promise.all([api.drivers.list(), api.constructors.list()])
      .then(([d, c]) => {
        if (!active) return;
        setDrivers(d);
        setTeams(c);
      })
      .catch((e) => active && setError(e instanceof Error ? e.message : "Hiba"))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  const colourOf = (id: number | null) =>
    teams.find((t) => t.ConstructorID === id)?.TeamColour ?? null;

  if (loading) return <div className="loading">Betöltés…</div>;
  if (error) return <div className="error">{error}</div>;

  return (
    <div className="drivers-page">
      <div className="drivers-header">
        <h1>Versenyzők</h1>
        {isAdmin && (
          <Link to="/admin/drivers" className="admin-add-btn">
            + Versenyzők kezelése
          </Link>
        )}
      </div>

      <div className="drivers-grid">
        {drivers.map((driver) => (
          <div
            key={driver.DriverID}
            className="driver-card"
            role="button"
            tabIndex={0}
            onClick={() => navigate(`/driver/${driver.DriverID}`)}
            onKeyDown={(e) => e.key === "Enter" && navigate(`/driver/${driver.DriverID}`)}
            style={{ background: teamGradient(colourOf(driver.ConstructorID)) }}
          >
            <DriverAvatar
              name={driver.Name}
              number={driver.DriverNumber}
              acronym={driver.Acronym}
              teamColour={colourOf(driver.ConstructorID)}
              image={driver.Image || null}
              size={140}
            />
            <div className="driver-name">{driver.Name}</div>
            <div className="driver-info">{driver.Nationality ?? "—"}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default DriversPage;
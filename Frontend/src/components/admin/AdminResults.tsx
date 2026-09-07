// ---------------------------------------------------------------------
//  src/adminPages/adminStatistics.tsx
//
//  Futameredmények kezelése. Ez a felület tölti fel az adatot, amiből
//  a bajnoki tabella és minden statisztika származik.
//
//  KÉT DOLOG, AMI ITT MÁS, MINT A RÉGI VERZIÓBAN:
//
//  1. A Points mező CSAK OLVASHATÓ. A b_assign_points trigger számolja
//     a helyezésből, az évből, a sprint jelzőből és a leggyorsabb körből.
//     A régi kódban kézzel be lehetett írni bármit, és UPDATE-nél a
//     trigger nem is futott (javitando_funkciok.md #14).
//
//  2. A győztes automatikusan frissül. Ha az 1. helyezettet átírod,
//     a grandprix.WinnerDriverID magától követi.
// ---------------------------------------------------------------------
import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../api";
import type { Driver, Constructor, GrandPrix, RaceResult } from "../../database.types";
import "../../Styles/driver.css";

type Row = RaceResult & {
  driver: Driver;
  constructor: Constructor;
  grandPrix: GrandPrix;
};

interface Form {
  GrandPrixID: string;
  DriverID: string;
  ConstructorID: string;
  Position: string;
  Grid: string;
  Laps: string;
  TimeOrRetired: string;
  FastestLap: boolean;
  GpOrSprint: boolean;
}

const EMPTY: Form = {
  GrandPrixID: "",
  DriverID: "",
  ConstructorID: "",
  Position: "",
  Grid: "",
  Laps: "",
  TimeOrRetired: "",
  FastestLap: false,
  GpOrSprint: true,
};

const AdminStatisticsPage: React.FC = () => {
  const [rows, setRows] = useState<Row[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [teams, setTeams] = useState<Constructor[]>([]);
  const [races, setRaces] = useState<GrandPrix[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [editing, setEditing] = useState<Row | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<Form>(EMPTY);
  const [confirmId, setConfirmId] = useState<number | null>(null);
  const [filterGp, setFilterGp] = useState<string>("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [r, d, c, g] = await Promise.all([
        api.raceResults.list(),
        api.drivers.list(),
        api.constructors.list(),
        api.grandPrix.list(),
      ]);
      setRows(r as Row[]);
      setDrivers(d);
      setTeams(c);
      setRaces(g);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Betöltési hiba.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const openAdd = () => {
    setEditing(null);
    setForm({ ...EMPTY, GrandPrixID: filterGp });
    setShowForm(true);
    setError(null);
  };

  const openEdit = (r: Row) => {
    setEditing(r);
    setForm({
      GrandPrixID: String(r.GrandPrixID),
      DriverID: String(r.DriverID),
      ConstructorID: String(r.ConstructorID),
      Position: r.Position?.toString() ?? "",
      Grid: r.Grid?.toString() ?? "",
      Laps: r.Laps?.toString() ?? "",
      TimeOrRetired: r.TimeOrRetired ?? "",
      FastestLap: r.FastestLap,
      GpOrSprint: r.GpOrSprint,
    });
    setShowForm(true);
    setError(null);
  };

  /** Versenyző kiválasztásakor a csapatát is beállítjuk. */
  const pickDriver = (driverId: string) => {
    const d = drivers.find((x) => x.DriverID === Number(driverId));
    setForm((f) => ({
      ...f,
      DriverID: driverId,
      ConstructorID: d?.ConstructorID ? String(d.ConstructorID) : f.ConstructorID,
    }));
  };

  const save = async () => {
    if (!form.GrandPrixID || !form.DriverID || !form.ConstructorID) {
      setError("A futam, a versenyző és a csapat megadása kötelező.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload = {
        GrandPrixID: Number(form.GrandPrixID),
        DriverID: Number(form.DriverID),
        ConstructorID: Number(form.ConstructorID),
        Position: form.Position === "" ? null : Number(form.Position),
        Grid: form.Grid === "" ? null : Number(form.Grid),
        Laps: form.Laps === "" ? null : Number(form.Laps),
        TimeOrRetired: form.TimeOrRetired.trim() || null,
        FastestLap: form.FastestLap,
        GpOrSprint: form.GpOrSprint,
      };
      if (editing) await api.raceResults.update(editing.ResultID, payload);
      else await api.raceResults.create(payload);
      setShowForm(false);
      await refresh();
    } catch (e) {
      // Itt jönnek elő: "legfeljebb 20 pozíció", "Ez a pozíció már foglalt",
      // "duplicate key ... race_result_gp_driver_type_unique"
      setError(e instanceof Error ? e.message : "A mentés nem sikerült.");
    } finally {
      setSaving(false);
    }
  };

  const del = async (id: number) => {
    setSaving(true);
    try {
      await api.raceResults.remove(id);
      setConfirmId(null);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "A törlés nem sikerült.");
    } finally {
      setSaving(false);
    }
  };

  const visible = filterGp
    ? rows.filter((r) => String(r.GrandPrixID) === filterGp)
    : rows;

  return (
    <div className="admin-page">
      <header className="admin-header">
        <h1>Futameredmények kezelése</h1>
        <div className="admin-actions">
          <select value={filterGp} onChange={(e) => setFilterGp(e.target.value)}>
            <option value="">Összes futam</option>
            {races.map((g) => (
              <option key={g.GrandPrixID} value={g.GrandPrixID}>
                {g.Year} – {g.Name}
              </option>
            ))}
          </select>
          <button type="button" className="btn btn--primary" onClick={openAdd}>
            + Új eredmény
          </button>
          <Link to="/statistics" className="btn">
            Vissza
          </Link>
        </div>
      </header>

      <p style={{ opacity: 0.75 }}>
        A pontszámot az adatbázis számolja a helyezésből — nem szerkeszthető.
      </p>

      {error && (
        <div className="admin-error" role="alert">
          {error}
          <button type="button" onClick={() => setError(null)} aria-label="Bezárás">
            ×
          </button>
        </div>
      )}

      {loading ? (
        <div className="page-state">Betöltés…</div>
      ) : (
        <table className="admin-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Futam</th>
              <th>Típus</th>
              <th>Versenyző</th>
              <th>Csapat</th>
              <th>Poz.</th>
              <th>Rajt</th>
              <th>Kör</th>
              <th>LK</th>
              <th>Pont</th>
              <th>Műveletek</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((r) => (
              <tr key={r.ResultID}>
                <td>{r.ResultID}</td>
                <td>{r.grandPrix?.Name ?? r.GrandPrixID}</td>
                <td>{r.GpOrSprint ? "Futam" : "Sprint"}</td>
                <td>{r.driver?.Name ?? r.DriverID}</td>
                <td>{r.constructor?.Name ?? r.ConstructorID}</td>
                <td>{r.Position ?? "DNF"}</td>
                <td>{r.Grid ?? "—"}</td>
                <td>{r.Laps ?? "—"}</td>
                <td>{r.FastestLap ? "⏱" : ""}</td>
                <td className="points-cell">{Number(r.Points)}</td>
                <td className="admin-row-actions">
                  <button type="button" className="btn btn--sm" onClick={() => openEdit(r)}>
                    Szerkesztés
                  </button>
                  {confirmId === r.ResultID ? (
                    <>
                      <button
                        type="button"
                        className="btn btn--sm btn--danger"
                        disabled={saving}
                        onClick={() => del(r.ResultID)}
                      >
                        Biztos?
                      </button>
                      <button
                        type="button"
                        className="btn btn--sm"
                        onClick={() => setConfirmId(null)}
                      >
                        Mégse
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      className="btn btn--sm btn--danger"
                      onClick={() => setConfirmId(r.ResultID)}
                    >
                      Törlés
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {showForm && (
        <div className="modal-backdrop" onClick={() => setShowForm(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>{editing ? "Eredmény szerkesztése" : "Új eredmény"}</h2>

            <label>Futam *</label>
            <select
              value={form.GrandPrixID}
              onChange={(e) => setForm({ ...form, GrandPrixID: e.target.value })}
            >
              <option value="">— válassz —</option>
              {races.map((g) => (
                <option key={g.GrandPrixID} value={g.GrandPrixID}>
                  {g.Year} – {g.Name}
                </option>
              ))}
            </select>

            <label>Versenyző *</label>
            <select value={form.DriverID} onChange={(e) => pickDriver(e.target.value)}>
              <option value="">— válassz —</option>
              {drivers.map((d) => (
                <option key={d.DriverID} value={d.DriverID}>
                  {d.Name}
                </option>
              ))}
            </select>

            <label>Csapat *</label>
            <select
              value={form.ConstructorID}
              onChange={(e) => setForm({ ...form, ConstructorID: e.target.value })}
            >
              <option value="">— válassz —</option>
              {teams.map((t) => (
                <option key={t.ConstructorID} value={t.ConstructorID}>
                  {t.Name}
                </option>
              ))}
            </select>

            <label>Helyezés (üresen = kiesett)</label>
            <input
              type="number"
              min={1}
              max={26}
              value={form.Position}
              onChange={(e) => setForm({ ...form, Position: e.target.value })}
            />

            <label>Rajthely</label>
            <input
              type="number"
              min={1}
              value={form.Grid}
              onChange={(e) => setForm({ ...form, Grid: e.target.value })}
            />

            <label>Megtett körök</label>
            <input
              type="number"
              min={0}
              value={form.Laps}
              onChange={(e) => setForm({ ...form, Laps: e.target.value })}
            />

            <label>Idő / kiesés oka</label>
            <input
              value={form.TimeOrRetired}
              onChange={(e) => setForm({ ...form, TimeOrRetired: e.target.value })}
              placeholder="+5.243s vagy Engine"
            />

            <label>
              <input
                type="checkbox"
                checked={form.GpOrSprint}
                onChange={(e) => setForm({ ...form, GpOrSprint: e.target.checked })}
              />{" "}
              Futam (kipipálatlan = sprint)
            </label>

            <label>
              <input
                type="checkbox"
                checked={form.FastestLap}
                onChange={(e) => setForm({ ...form, FastestLap: e.target.checked })}
              />{" "}
              Leggyorsabb kör (2019–2024 között +1 pont a top10-ben)
            </label>

            <div className="modal-actions">
              <button type="button" className="btn btn--primary" onClick={save} disabled={saving}>
                {saving ? "Mentés…" : "Mentés"}
              </button>
              <button
                type="button"
                className="btn"
                onClick={() => setShowForm(false)}
                disabled={saving}
              >
                Mégse
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminStatisticsPage;
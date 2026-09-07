// ---------------------------------------------------------------------
//  src/adminPages/adminDriverPage.tsx
//
//  MINTA a többi admin oldalhoz (constructors, circuits, grandprix).
//  A szerkezet mindenhol azonos, csak az api.<erőforrás> és a mezőlista tér el.
//
//  Változások a régihez képest:
//   - nincs fetch/API_BASE, nincs kézi CSRF-token
//   - a hibák megjelennek a felületen (a régi kód console.error-ba nyelte)
//   - az adatbázis-trigger hibaüzenetei magyarul jutnak el a felhasználóhoz
//     (pl. "A pilótának legalább 18 évesnek kell lennie")
//   - a jogosultságot az RLS érvényesíti: ha valaki nem admin, az INSERT
//     42501-gyel elszáll, függetlenül attól, mit lát a böngészőben
// ---------------------------------------------------------------------
import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../api";
import type { Driver, Constructor } from "../../database.types";
import DriverAvatar from "../DriverAvatar";
import "../../Styles/driver.css";

interface DriverForm {
  Name: string;
  ConstructorID: string;
  Nationality: string;
  BirthDate: string;
  DriverNumber: string;
  Acronym: string;
  Biography: string;
  Image: string;
}

const EMPTY_FORM: DriverForm = {
  Name: "",
  ConstructorID: "",
  Nationality: "",
  BirthDate: "",
  DriverNumber: "",
  Acronym: "",
  Biography: "",
  Image: "",
};

function toForm(d: Driver): DriverForm {
  return {
    Name: d.Name ?? "",
    ConstructorID: d.ConstructorID?.toString() ?? "",
    Nationality: d.Nationality ?? "",
    BirthDate: d.BirthDate ?? "",
    DriverNumber: d.DriverNumber?.toString() ?? "",
    Acronym: d.Acronym ?? "",
    Biography: d.Biography ?? "",
    Image: d.Image ?? "",
  };
}

function toPayload(f: DriverForm): Partial<Driver> {
  return {
    Name: f.Name.trim(),
    ConstructorID: f.ConstructorID ? Number(f.ConstructorID) : null,
    Nationality: f.Nationality.trim() || null,
    BirthDate: f.BirthDate || null,
    DriverNumber: f.DriverNumber ? Number(f.DriverNumber) : null,
    Acronym: f.Acronym.trim().toUpperCase().slice(0, 3) || null,
    Biography: f.Biography.trim() || null,
    Image: f.Image.trim(),
  };
}

const AdminDriverPage: React.FC = () => {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [teams, setTeams] = useState<Constructor[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [editing, setEditing] = useState<Driver | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<DriverForm>(EMPTY_FORM);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [d, c] = await Promise.all([api.drivers.list(), api.constructors.list()]);
      setDrivers(d);
      setTeams(c);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Az adatok betöltése nem sikerült.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const teamName = (id: number | null) =>
    teams.find((t) => t.ConstructorID === id)?.Name ?? "—";

  const teamColour = (id: number | null) =>
    teams.find((t) => t.ConstructorID === id)?.TeamColour ?? null;

  const openAdd = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
    setError(null);
  };

  const openEdit = (d: Driver) => {
    setEditing(d);
    setForm(toForm(d));
    setShowForm(true);
    setError(null);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditing(null);
    setForm(EMPTY_FORM);
  };

  const handleSave = async () => {
    if (!form.Name.trim()) {
      setError("A név megadása kötelező.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (editing) {
        await api.drivers.update(editing.DriverID, toPayload(form));
      } else {
        await api.drivers.create(toPayload(form));
      }
      closeForm();
      await load();
    } catch (e) {
      // Itt jönnek elő az adatbázis-triggerek üzenetei, pl.
      // "A pilótának legalább 18 évesnek kell lennie (Teszt Elek)"
      setError(e instanceof Error ? e.message : "A mentés nem sikerült.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    setSaving(true);
    setError(null);
    try {
      await api.drivers.remove(id);
      setDeleteConfirmId(null);
      await load();
    } catch (e) {
      // Pl. 23503: a versenyzőre még hivatkozik egy futameredmény
      setError(e instanceof Error ? e.message : "A törlés nem sikerült.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="admin-page">
      <header className="admin-header">
        <h1>Versenyzők kezelése</h1>
        <div className="admin-actions">
          <button type="button" className="btn btn--primary" onClick={openAdd}>
            + Új versenyző
          </button>
          <Link to="/driver" className="btn">
            Vissza
          </Link>
        </div>
      </header>

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
              <th></th>
              <th>Név</th>
              <th>Rajtszám</th>
              <th>Csapat</th>
              <th>Nemzetiség</th>
              <th>Születés</th>
              <th>Műveletek</th>
            </tr>
          </thead>
          <tbody>
            {drivers.map((d) => (
              <tr key={d.DriverID}>
                <td>{d.DriverID}</td>
                <td>
                  <DriverAvatar
                    name={d.Name}
                    number={d.DriverNumber}
                    acronym={d.Acronym}
                    teamColour={teamColour(d.ConstructorID)}
                    image={d.Image || null}
                    size={38}
                  />
                </td>
                <td>{d.Name}</td>
                <td>{d.DriverNumber ?? "—"}</td>
                <td>{teamName(d.ConstructorID)}</td>
                <td>{d.Nationality ?? "—"}</td>
                <td>{d.BirthDate ?? "—"}</td>
                <td className="admin-row-actions">
                  <button type="button" className="btn btn--sm" onClick={() => openEdit(d)}>
                    Szerkesztés
                  </button>

                  {deleteConfirmId === d.DriverID ? (
                    <>
                      <button
                        type="button"
                        className="btn btn--sm btn--danger"
                        disabled={saving}
                        onClick={() => handleDelete(d.DriverID)}
                      >
                        Biztos?
                      </button>
                      <button
                        type="button"
                        className="btn btn--sm"
                        onClick={() => setDeleteConfirmId(null)}
                      >
                        Mégse
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      className="btn btn--sm btn--danger"
                      onClick={() => setDeleteConfirmId(d.DriverID)}
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
        <div className="modal-backdrop" onClick={closeForm}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>{editing ? "Versenyző szerkesztése" : "Új versenyző"}</h2>

            <label>Név *</label>
            <input
              value={form.Name}
              onChange={(e) => setForm({ ...form, Name: e.target.value })}
            />

            <label>Rajtszám</label>
            <input
              type="number"
              min={1}
              max={99}
              value={form.DriverNumber}
              onChange={(e) => setForm({ ...form, DriverNumber: e.target.value })}
            />

            <label>Rövidítés (3 betű)</label>
            <input
              maxLength={3}
              value={form.Acronym}
              onChange={(e) => setForm({ ...form, Acronym: e.target.value.toUpperCase() })}
            />

            <label>Csapat</label>
            <select
              value={form.ConstructorID}
              onChange={(e) => setForm({ ...form, ConstructorID: e.target.value })}
            >
              <option value="">— nincs —</option>
              {teams.map((t) => (
                <option key={t.ConstructorID} value={t.ConstructorID}>
                  {t.Name}
                </option>
              ))}
            </select>

            <label>Nemzetiség</label>
            <input
              value={form.Nationality}
              onChange={(e) => setForm({ ...form, Nationality: e.target.value })}
            />

            <label>Születési dátum</label>
            <input
              type="date"
              value={form.BirthDate}
              onChange={(e) => setForm({ ...form, BirthDate: e.target.value })}
            />

            <label>Kép URL (üresen hagyva generált avatar)</label>
            <input
              value={form.Image}
              onChange={(e) => setForm({ ...form, Image: e.target.value })}
              placeholder="https://…"
            />

            <label>Életrajz</label>
            <textarea
              rows={4}
              value={form.Biography}
              onChange={(e) => setForm({ ...form, Biography: e.target.value })}
            />

            <div className="modal-actions">
              <button
                type="button"
                className="btn btn--primary"
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? "Mentés…" : "Mentés"}
              </button>
              <button type="button" className="btn" onClick={closeForm} disabled={saving}>
                Mégse
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDriverPage;
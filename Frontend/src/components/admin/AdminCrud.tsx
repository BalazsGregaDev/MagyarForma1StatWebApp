// ---------------------------------------------------------------------
//  src/adminPages/AdminCrud.tsx
//
//  Közös CRUD-komponens. A régi kódban a négy admin oldal ~200 sornyi
//  azonos logikát duplikált (betöltés, modal, kétlépcsős törlés, hibakezelés).
//  Itt egyszer van meg, az oldalak csak a mezőlistát adják meg.
// ---------------------------------------------------------------------
import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import "../../Styles/driver.css";

export interface FieldDef<T> {
  key: keyof T & string;
  label: string;
  type?: "text" | "number" | "date" | "textarea" | "select" | "checkbox" | "color";
  /** select típushoz */
  options?: { value: string | number; label: string }[];
  required?: boolean;
  /** Táblázatban megjelenjen-e */
  inTable?: boolean;
  /** Egyedi megjelenítés a táblázatban */
  render?: (row: T) => React.ReactNode;
  placeholder?: string;
  help?: string;
}

interface Props<T> {
  title: string;
  backTo: string;
  idKey: keyof T & string;
  fields: FieldDef<T>[];
  load: () => Promise<T[]>;
  create: (payload: Partial<T>) => Promise<unknown>;
  update: (id: number, payload: Partial<T>) => Promise<unknown>;
  remove: (id: number) => Promise<void>;
  /** Extra oszlop a táblázat elejére (pl. avatar) */
  leading?: (row: T) => React.ReactNode;
}

function emptyForm<T>(fields: FieldDef<T>[]): Record<string, string | boolean> {
  const f: Record<string, string | boolean> = {};
  fields.forEach((x) => (f[x.key] = x.type === "checkbox" ? false : ""));
  return f;
}

function toForm<T extends Record<string, unknown>>(
  row: T,
  fields: FieldDef<T>[],
): Record<string, string | boolean> {
  const f: Record<string, string | boolean> = {};
  fields.forEach((x) => {
    const v = row[x.key];
    f[x.key] = x.type === "checkbox" ? Boolean(v) : v == null ? "" : String(v);
  });
  return f;
}

function toPayload<T>(
  form: Record<string, string | boolean>,
  fields: FieldDef<T>[],
): Partial<T> {
  const out: Record<string, unknown> = {};
  fields.forEach((x) => {
    const v = form[x.key];
    if (x.type === "checkbox") out[x.key] = Boolean(v);
    else if (x.type === "number" || x.type === "select")
      out[x.key] = v === "" ? null : Number(v);
    else out[x.key] = v === "" ? null : String(v).trim();
  });
  return out as Partial<T>;
}

export default function AdminCrud<T extends Record<string, any>>({
  title,
  backTo,
  idKey,
  fields,
  load,
  create,
  update,
  remove,
  leading,
}: Props<T>) {
  const [rows, setRows] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [editing, setEditing] = useState<T | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(() => emptyForm(fields));
  const [confirmId, setConfirmId] = useState<number | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRows(await load());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Betöltési hiba.");
    } finally {
      setLoading(false);
    }
  }, [load]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const openAdd = () => {
    setEditing(null);
    setForm(emptyForm(fields));
    setShowForm(true);
    setError(null);
  };

  const openEdit = (row: T) => {
    setEditing(row);
    setForm(toForm(row, fields));
    setShowForm(true);
    setError(null);
  };

  const close = () => {
    setShowForm(false);
    setEditing(null);
  };

  const save = async () => {
    const missing = fields.find((f) => f.required && !form[f.key]);
    if (missing) {
      setError(`A(z) "${missing.label}" mező kitöltése kötelező.`);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload = toPayload(form, fields);
      if (editing) await update(Number(editing[idKey]), payload);
      else await create(payload);
      close();
      await refresh();
    } catch (e) {
      // Az adatbázis-triggerek magyar üzenetei itt jelennek meg
      setError(e instanceof Error ? e.message : "A mentés nem sikerült.");
    } finally {
      setSaving(false);
    }
  };

  const del = async (id: number) => {
    setSaving(true);
    setError(null);
    try {
      await remove(id);
      setConfirmId(null);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "A törlés nem sikerült.");
    } finally {
      setSaving(false);
    }
  };

  const tableFields = fields.filter((f) => f.inTable !== false);

  return (
    <div className="admin-page">
      <header className="admin-header">
        <h1>{title}</h1>
        <div className="admin-actions">
          <button type="button" className="btn btn--primary" onClick={openAdd}>
            + Új
          </button>
          <Link to={backTo} className="btn">
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
              {leading && <th />}
              {tableFields.map((f) => (
                <th key={f.key}>{f.label}</th>
              ))}
              <th>Műveletek</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const id = Number(row[idKey]);
              return (
                <tr key={id}>
                  <td>{id}</td>
                  {leading && <td>{leading(row)}</td>}
                  {tableFields.map((f) => (
                    <td key={f.key}>
                      {f.render
                        ? f.render(row)
                        : f.type === "checkbox"
                          ? row[f.key]
                            ? "igen"
                            : "nem"
                          : (row[f.key] ?? "—")}
                    </td>
                  ))}
                  <td className="admin-row-actions">
                    <button type="button" className="btn btn--sm" onClick={() => openEdit(row)}>
                      Szerkesztés
                    </button>
                    {confirmId === id ? (
                      <>
                        <button
                          type="button"
                          className="btn btn--sm btn--danger"
                          disabled={saving}
                          onClick={() => del(id)}
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
                        onClick={() => setConfirmId(id)}
                      >
                        Törlés
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {showForm && (
        <div className="modal-backdrop" onClick={close}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>{editing ? "Szerkesztés" : "Új rekord"}</h2>

            {fields.map((f) => (
              <React.Fragment key={f.key}>
                <label>
                  {f.label}
                  {f.required && " *"}
                </label>

                {f.type === "textarea" ? (
                  <textarea
                    rows={4}
                    value={String(form[f.key] ?? "")}
                    onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                  />
                ) : f.type === "select" ? (
                  <select
                    value={String(form[f.key] ?? "")}
                    onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                  >
                    <option value="">— nincs —</option>
                    {f.options?.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                ) : f.type === "checkbox" ? (
                  <input
                    type="checkbox"
                    checked={Boolean(form[f.key])}
                    onChange={(e) => setForm({ ...form, [f.key]: e.target.checked })}
                  />
                ) : (
                  <input
                    type={f.type ?? "text"}
                    placeholder={f.placeholder}
                    value={String(form[f.key] ?? "")}
                    onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                  />
                )}

                {f.help && <small style={{ opacity: 0.7 }}>{f.help}</small>}
              </React.Fragment>
            ))}

            <div className="modal-actions">
              <button type="button" className="btn btn--primary" onClick={save} disabled={saving}>
                {saving ? "Mentés…" : "Mentés"}
              </button>
              <button type="button" className="btn" onClick={close} disabled={saving}>
                Mégse
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
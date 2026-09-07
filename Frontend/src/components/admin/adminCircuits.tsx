// ---------------------------------------------------------------------
//  src/adminPages/adminCircuitPage.tsx
//
//  FIGYELEM: a régi Laravel oldalon ez a felület törött volt.
//  A Circuits modell $fillable listája a nem létező 'Nation' és 'DriverID'
//  oszlopokat tartalmazta, és HIÁNYZOTT belőle a Country, Length, Laps —
//  ezért a pályafelvitel SQL-hibával elszállt (javitando_funkciok.md #10).
//  Itt a mezők a tényleges séma szerint szerepelnek.
// ---------------------------------------------------------------------
import React from "react";
import AdminCrud, { type FieldDef } from "../../adminPages/AdminCrud";
import api, { formatLapTime } from "../../api";
import type { Circuit } from "../../database.types";

const fields: FieldDef<Circuit>[] = [
  { key: "Name", label: "Név", required: true },
  { key: "Location", label: "Helyszín" },
  { key: "Country", label: "Ország" },
  {
    key: "Length",
    label: "Hossz (km)",
    type: "number",
    placeholder: "4.381",
  },
  { key: "Laps", label: "Körök", type: "number" },
  { key: "FirstGrandPrix", label: "Első GP", type: "number" },
  { key: "RecordDriver", label: "Rekorder", inTable: false },
  {
    key: "RecordLapTime",
    label: "Körrekord",
    placeholder: "00:01:16.627",
    help: "Formátum: óra:perc:másodperc.ezred. Egy 1:16.627-es kör = 00:01:16.627",
    render: (c) => formatLapTime(c.RecordLapTime),
  },
  {
    key: "Image",
    label: "Pályarajz URL",
    inTable: false,
    placeholder: "https://…",
  },
  {
    key: "image_author",
    label: "Kép szerzője",
    inTable: false,
    help: "CC-licencű képnél kötelező. OSM-alapú saját rajznál: © OpenStreetMap contributors",
  },
  {
    key: "image_license",
    label: "Kép licence",
    inTable: false,
    placeholder: "CC BY-SA 4.0 / ODbL",
  },
  { key: "image_source_url", label: "Kép forrás URL", inTable: false },
];

const AdminCircuitPage: React.FC = () => (
  <AdminCrud<Circuit>
    title="Pályák kezelése"
    backTo="/circuit"
    idKey="CircuitID"
    fields={fields}
    load={api.circuits.list}
    create={api.circuits.create}
    update={api.circuits.update}
    remove={api.circuits.remove}
  />
);

export default AdminCircuitPage;

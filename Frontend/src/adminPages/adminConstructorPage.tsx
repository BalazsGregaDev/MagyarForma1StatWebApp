// ---------------------------------------------------------------------
//  src/adminPages/adminConstructorPage.tsx
// ---------------------------------------------------------------------
import React from "react";
import AdminCrud, { type FieldDef } from "./AdminCrud";
import api, { teamGradient } from "../lib/api";
import type { Constructor } from "../lib/database.types";

const fields: FieldDef<Constructor>[] = [
  { key: "Name", label: "Név", required: true },
  { key: "Nationality", label: "Nemzetiség" },
  { key: "FoundedYear", label: "Alapítás éve", type: "number" },
  { key: "TeamPrincipal", label: "Csapatfőnök" },
  {
    key: "TeamColour",
    label: "Csapatszín",
    type: "color",
    help: "A kártyák és diagramok gradiensei ebből épülnek. Formátum: #RRGGBB",
  },
  { key: "WorldChampionships", label: "VB-címek", type: "number" },
  { key: "Wins", label: "Győzelmek", type: "number" },
  { key: "PolePositions", label: "Pole-ok", type: "number", inTable: false },
  { key: "Podiums", label: "Dobogók", type: "number", inTable: false },
  { key: "Image", label: "Logó URL", inTable: false, placeholder: "https://…" },
  { key: "History", label: "Történet", type: "textarea", inTable: false },
];

const AdminConstructorPage: React.FC = () => (
  <AdminCrud<Constructor>
    title="Csapatok kezelése"
    backTo="/constructor"
    idKey="ConstructorID"
    fields={fields}
    load={api.constructors.list}
    create={api.constructors.create}
    update={api.constructors.update}
    remove={api.constructors.remove}
    leading={(c) => (
      <span
        style={{
          display: "inline-block",
          width: 28,
          height: 28,
          borderRadius: 6,
          border: "2px solid #000",
          background: teamGradient(c.TeamColour),
        }}
      />
    )}
  />
);

export default AdminConstructorPage;
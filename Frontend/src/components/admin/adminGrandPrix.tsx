// ---------------------------------------------------------------------
//  src/adminPages/adminGrandPrixPage.tsx
//
//  A WinnerDriverID szándékosan NEM szerkeszthető mező: azt a
//  z_sync_race_winner trigger állítja be a futameredményből, és az
//  a_lock_race_winner trigger véd a kézi felülírás ellen.
//  Ha egy győztest javítani kell, a futameredményt kell átírni.
// ---------------------------------------------------------------------
import React, { useEffect, useState } from "react";
import AdminCrud, { type FieldDef } from "./AdminCrud";
import api from "../lib/api";
import type { GrandPrix, Circuit } from "../lib/database.types";

const AdminGrandPrixPage: React.FC = () => {
  const [circuits, setCircuits] = useState<Circuit[]>([]);

  useEffect(() => {
    api.circuits.list().then(setCircuits).catch(() => {});
  }, []);

  const fields: FieldDef<GrandPrix>[] = [
    { key: "Name", label: "Név", required: true },
    { key: "Country", label: "Ország" },
    { key: "Year", label: "Év", type: "number", required: true },
    { key: "Round", label: "Forduló", type: "number" },
    { key: "RaceDate", label: "Dátum", type: "date" },
    {
      key: "CircuitID",
      label: "Pálya",
      type: "select",
      options: circuits.map((c) => ({ value: c.CircuitID, label: c.Name })),
      render: (gp) =>
        circuits.find((c) => c.CircuitID === gp.CircuitID)?.Name ?? "—",
    },
    {
      key: "WinnerDriverID",
      label: "Győztes",
      inTable: true,
      // Csak megjelenítés; a szerkesztő űrlapon nem szerepel mezőként,
      // mert az api.grandPrix.update() amúgy is kiszűri.
      render: (gp) => (gp.WinnerDriverID ? `#${gp.WinnerDriverID}` : "—"),
    },
    { key: "Image", label: "Borítókép URL", inTable: false, placeholder: "https://…" },
  ];

  // A győztes mezőt kivesszük a szerkeszthető listából
  const editableFields = fields.filter((f) => f.key !== "WinnerDriverID");

  return (
    <AdminCrud<GrandPrix>
      title="Nagydíjak kezelése"
      backTo="/grand_prix"
      idKey="GrandPrixID"
      fields={editableFields.concat(
        fields.filter((f) => f.key === "WinnerDriverID").map((f) => ({
          ...f,
          // read-only megjelenítéshez: nem kerül az űrlapra
          inTable: true,
        })),
      )}
      load={() => api.grandPrix.list()}
      create={api.grandPrix.create}
      update={api.grandPrix.update}
      remove={api.grandPrix.remove}
    />
  );
};

export default AdminGrandPrixPage;
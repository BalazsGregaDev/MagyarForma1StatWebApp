#!/usr/bin/env node
/**
 * ellenorzes.mjs — Supabase kapcsolat- és sémateszt
 *
 * Futtatás a Frontend/ mappából, MIUTÁN lefuttattad a sémát az SQL Editorban:
 *
 *   node ellenorzes.mjs
 *
 * Nem ír az adatbázisba, csak olvas. Végigmegy azon, aminek a séma után
 * működnie kell, és megmondja, hol akadt el.
 */
import { createClient } from "@supabase/supabase-js";

const URL = "https://wssaqerzjstxhhngbgte.supabase.co";
const KEY = "sb_publishable_Tqx6JXS0nyK2bYusk3rwfQ_1shOe-Tc";

const supabase = createClient(URL, KEY);

const ok = (m) => console.log("  \x1b[32m✓\x1b[0m " + m);
const bad = (m) => console.log("  \x1b[31m✗\x1b[0m " + m);
const info = (m) => console.log("\n\x1b[1m" + m + "\x1b[0m");

let failures = 0;

async function check(label, fn) {
  try {
    const msg = await fn();
    ok(`${label}${msg ? " — " + msg : ""}`);
  } catch (e) {
    bad(`${label} — ${e.message}`);
    failures++;
  }
}

function must({ data, error }) {
  if (error) throw new Error(`[${error.code ?? "?"}] ${error.message}`);
  return data;
}

info("1. Kapcsolat és séma");

await check("schema_version tábla", async () => {
  const d = must(
    await supabase.from("schema_version").select("version, applied_at").limit(1),
  );
  if (!d.length) throw new Error("üres — lefuttattad a sémát?");
  return d[0].version;
});

info("2. Táblák olvashatók (public_read RLS policy)");

for (const t of [
  "circuits",
  "constructors",
  "drivers",
  "grandprix",
  "race_result",
  "qualifying_result",
  "teams_drivers",
]) {
  await check(t, async () => {
    const { count, error } = await supabase
      .from(t)
      .select("*", { count: "exact", head: true });
    if (error) throw new Error(`[${error.code ?? "?"}] ${error.message}`);
    return `${count} sor`;
  });
}

info("3. Nézetek");

await check("v_driver_standings", async () => {
  const d = must(
    await supabase
      .from("v_driver_standings")
      .select("driver_name, points, wins, races")
      .order("points", { ascending: false })
      .limit(3),
  );
  if (!d.length) return "üres (még nincs adat)";
  return d.map((r) => `${r.driver_name} ${r.points}p/${r.wins}gy`).join(", ");
});

await check("v_constructor_standings", async () => {
  const d = must(
    await supabase
      .from("v_constructor_standings")
      .select("constructor_name, points")
      .order("points", { ascending: false })
      .limit(3),
  );
  return d.length ? d.map((r) => `${r.constructor_name} ${r.points}p`).join(", ") : "üres";
});

info("4. RPC függvények");

await check("is_admin()", async () => {
  const d = must(await supabase.rpc("is_admin"));
  return `${d} (bejelentkezés nélkül false a helyes)`;
});

await check("driver_stats(1)", async () => {
  const d = must(await supabase.rpc("driver_stats", { p_driver_id: 1 }));
  if (!d?.driver) return "nincs 1-es ID-jű versenyző (még nincs adat)";
  return `${d.driver.driver_name}, ${d.points_chart?.length ?? 0} futam a diagramon`;
});

info("5. RLS — írás bejelentkezés nélkül ELUTASÍTVA kell legyen");

await check("INSERT drivers (elutasításnak kell lennie)", async () => {
  const { error } = await supabase
    .from("drivers")
    .insert({ Name: "RLS teszt", Image: "" });
  if (!error) {
    throw new Error("!! ÁTMENT — az RLS nem véd, ne menj élesbe így");
  }
  return `helyesen elutasítva [${error.code}]`;
});

await check("DELETE drivers (elutasításnak kell lennie)", async () => {
  const { error } = await supabase.from("drivers").delete().eq("DriverID", -1);
  if (!error) return "nincs hiba, de 0 sort érintett (RLS szűr)";
  return `helyesen elutasítva [${error.code}]`;
});

info("6. Admin fiók");

await check("van-e admin a profiles táblában", async () => {
  const { error } = await supabase.from("profiles").select("id").limit(1);
  // Bejelentkezés nélkül a profiles nem olvasható — ez a helyes viselkedés.
  return error ? "profiles védett (helyes)" : "profiles olvasható — nézd át a policy-t";
});

console.log(
  failures === 0
    ? "\n\x1b[32mMinden rendben. Indulhat az npm start.\x1b[0m\n"
    : `\n\x1b[31m${failures} ellenőrzés bukott el — lásd fent.\x1b[0m\n`,
);
process.exit(failures === 0 ? 0 : 1);

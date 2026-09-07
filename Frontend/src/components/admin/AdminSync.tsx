// ---------------------------------------------------------------------
//  src/components/admin/AdminSync.tsx
//
//  Adatszinkron felület. Ez váltja ki a curl parancsokat.
//
//  MIÉRT SZEZONONKÉNT, BÖNGÉSZŐBŐL VEZÉRELVE:
//  Az Edge Functionöknek van futásidő-korlátjuk. Egy szezon ~10-20 mp,
//  ami belefér; tizenkettő egy hívásban már nem biztos. Ezért a böngésző
//  hívja őket egyesével, és mutatja a haladást. Mellékhaszon: látod, hol
//  tart, és bármikor megállíthatod.
// ---------------------------------------------------------------------
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../supabaseClient";
import "../../Styles/driver.css";

const JOLPICA_FIRST = 1950;
const JOLPICA_LAST = 2022;
const OPENF1_FIRST = 2023;

interface SyncLogRow {
  id: number;
  provider: string;
  task: string;
  season: number | null;
  status: string;
  rows_upserted: number;
  requests_made: number;
  message: string | null;
  started_at: string;
  finished_at: string | null;
}

interface LineItem {
  text: string;
  kind: "info" | "ok" | "warn" | "error";
}

const AdminSync: React.FC = () => {
  const [log, setLog] = useState<SyncLogRow[]>([]);
  const [lines, setLines] = useState<LineItem[]>([]);
  const [running, setRunning] = useState(false);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [manualYear, setManualYear] = useState("");
  const [meetingYear, setMeetingYear] = useState("");
  const [meetingKey, setMeetingKey] = useState("");
  const stopRef = useRef(false);

  const say = useCallback((text: string, kind: LineItem["kind"] = "info") => {
    setLines((prev) => [...prev, { text, kind }]);
  }, []);

  /** Egy Edge Function hívás. A supabase-js magától küldi a bejelentkezett
   *  felhasználó tokenjét — nem kell titkot kezelnünk. */
  const invoke = useCallback(async (body: Record<string, unknown>) => {
    const { data, error } = await supabase.functions.invoke("sync-f1", { body });
    if (error) {
      // A függvény hibaüzenete a válasz törzsében jön
      let detail = error.message;
      try {
        const ctx = (error as { context?: Response }).context;
        if (ctx) detail = JSON.stringify(await ctx.json());
      } catch {
        /* marad az eredeti üzenet */
      }
      throw new Error(detail);
    }
    if (data?.error) throw new Error(String(data.error));
    return data as { upserted?: number; seasons?: number[]; requests?: number };
  }, []);

  const refresh = useCallback(async () => {
    const { data } = await supabase
      .from("sync_log")
      .select("*")
      .order("started_at", { ascending: false })
      .limit(30);
    setLog((data ?? []) as SyncLogRow[]);

    const tables = ["grandprix", "drivers", "constructors", "race_result", "circuits"] as const;
    const next: Record<string, number> = {};
    for (const t of tables) {
      const { count } = await supabase.from(t).select("*", { count: "exact", head: true });
      next[t] = count ?? 0;
    }
    setCounts(next);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  /** Melyik történelmi szezonok vannak kész? */
  const doneSeasons = new Set(
    log
      .filter((l) => l.provider === "jolpica" && l.task === "historical" && l.status === "ok")
      .map((l) => l.season)
      .filter((s): s is number => s != null),
  );

  const nextHistorical = (() => {
    for (let y = JOLPICA_FIRST; y <= JOLPICA_LAST; y++) {
      if (!doneSeasons.has(y)) return y;
    }
    return null;
  })();

  /* ---------------- Történelmi szinkron ---------------- */

  const runHistorical = async (howMany: number) => {
    setRunning(true);
    stopRef.current = false;
    setLines([]);

    let processed = 0;
    try {
      for (let i = 0; i < howMany; i++) {
        if (stopRef.current) {
          say("Megállítva.", "warn");
          break;
        }

        // Minden körben frissen kérdezzük, hol tartunk
        const { data } = await supabase
          .from("sync_log")
          .select("season")
          .eq("provider", "jolpica")
          .eq("task", "historical")
          .eq("status", "ok")
          .order("season", { ascending: false })
          .limit(1);

        const last = (data as { season: number }[] | null)?.[0]?.season;
        const year = last == null ? JOLPICA_FIRST : last + 1;

        if (year > JOLPICA_LAST) {
          say(`Kész: ${JOLPICA_FIRST}–${JOLPICA_LAST} minden szezonja megvan.`, "ok");
          break;
        }

        say(`${year} szinkronizálása…`);
        try {
          const res = await invoke({ task: "historical", season: year });
          const n = res.upserted ?? 0;
          processed++;
          say(`${year} kész — ${n} sor, ${res.requests ?? "?"} kérés.`, "ok");
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          if (msg.includes("limit") || msg.includes("Folytasd később")) {
            say(
              `${year}: elértük a Jolpica órás limitjét (500 kérés/óra). ` +
                `Folytasd egy óra múlva — ugyanonnan megy tovább.`,
              "warn",
            );
            break;
          }
          say(`${year}: ${msg}`, "error");
          break;
        }
      }
    } finally {
      setRunning(false);
      await refresh();
      if (processed > 0) say(`Összesen ${processed} szezon dolgozódott fel.`, "ok");
    }
  };

  /* ---------------- OpenF1 szinkron ---------------- */

  const runOpenF1 = async (years: number[]) => {
    setRunning(true);
    stopRef.current = false;
    setLines([]);
    try {
      for (const y of years) {
        if (stopRef.current) {
          say("Megállítva.", "warn");
          break;
        }

        // A `full` task EGY hívásban végzi a naptárat, a versenyzőket és
        // mind a ~24 futam eredményét — ez túllépi a Supabase Edge
        // Function compute-korlátját (546-os hiba). Három külön hívás
        // bőven belefér. A sorrend kötött: a `drivers` a `calendar`
        // session-kulcsaira épül, a `results` a versenyző-leképezésre.
        const steps = [
          { task: "calendar", label: "naptár" },
          { task: "drivers", label: "versenyzők" },
          { task: "results", label: "eredmények" },
        ] as const;

        let failed = false;
        for (const s of steps) {
          if (stopRef.current) break;
          say(`${y} — ${s.label}…`);
          try {
            const res = await invoke({ task: s.task, season: y });
            say(`${y} ${s.label}: ${res.upserted ?? 0} sor.`, "ok");
          } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            say(`${y} ${s.label}: ${msg}`, "error");
            if (msg.includes("RESOURCE_LIMIT") || msg.includes("compute")) {
              say(
                `A ${s.label} lépés túllépte a futásidő-korlátot. ` +
                  `Próbáld futamonként: alább az "Egy futam" mező.`,
                "warn",
              );
            }
            failed = true;
            break; // a következő lépés erre épülne
          }
        }
        if (failed && years.length > 1) break;
      }
    } finally {
      setRunning(false);
      await refresh();
    }
  };

  /** Egyetlen futam eredménye — ha a teljes szezon túllépi a korlátot. */
  const runOneMeeting = async (year: number, meetingKey: number) => {
    setRunning(true);
    setLines([]);
    try {
      say(`${year} / meeting ${meetingKey} — eredmények…`);
      const res = await invoke({ task: "results", season: year, meetingKey });
      say(`Kész — ${res.upserted ?? 0} sor.`, "ok");
    } catch (e) {
      say(`${e instanceof Error ? e.message : String(e)}`, "error");
    } finally {
      setRunning(false);
      await refresh();
    }
  };

  /** Tetszőleges történelmi év újrafuttatása. A nextUnsyncedSeason
   *  mindig a legnagyobb kész év utánit adja, ezért egy közbenső évet
   *  (pl. a hiányos időmérőjű 1994-2002) másképp nem lehet pótolni. */
  const runOneHistorical = async (year: number) => {
    setRunning(true);
    setLines([]);
    try {
      say(`${year} újraszinkronizálása…`);
      const res = await invoke({ task: "historical", season: year });
      say(`${year} kész — ${res.upserted ?? 0} sor.`, "ok");
    } catch (e) {
      say(`${year}: ${e instanceof Error ? e.message : String(e)}`, "error");
    } finally {
      setRunning(false);
      await refresh();
    }
  };

  const currentYear = new Date().getUTCFullYear();
  const openF1Years: number[] = [];
  for (let y = OPENF1_FIRST; y <= currentYear; y++) openF1Years.push(y);

  const progress = Math.round(
    (doneSeasons.size / (JOLPICA_LAST - JOLPICA_FIRST + 1)) * 100,
  );

  return (
    <div className="admin-page">
      <header className="admin-header">
        <h1>Adatszinkron</h1>
        <Link to="/" className="btn">
          Vissza
        </Link>
      </header>

      {/* ---------- Állapot ---------- */}
      <section className="driver-detail-stats">
        {Object.entries(counts).map(([t, n]) => (
          <div className="driver-detail-card" key={t}>
            <span className="driver-detail-label">{t}</span>
            <span className="driver-detail-value">{n.toLocaleString("hu-HU")}</span>
          </div>
        ))}
      </section>

      {/* ---------- Történelmi ---------- */}
      <section style={{ marginTop: "2rem" }}>
        <h2>Történelmi adatok — {JOLPICA_FIRST}–{JOLPICA_LAST}</h2>
        <p style={{ opacity: 0.75 }}>
          Forrás: Jolpica-F1. A rate limit 500 kérés óránként, ezért a teljes
          visszatöltés több menetben megy. Ott folytatja, ahol abbahagyta.
        </p>

        <div
          style={{
            background: "rgba(255,255,255,0.1)",
            borderRadius: 6,
            height: 22,
            overflow: "hidden",
            margin: "1rem 0",
          }}
        >
          <div
            style={{
              width: `${progress}%`,
              height: "100%",
              background: "linear-gradient(90deg,#e10600,#ff6b00)",
              transition: "width .3s",
            }}
          />
        </div>
        <p>
          <strong>{doneSeasons.size}</strong> / {JOLPICA_LAST - JOLPICA_FIRST + 1} szezon
          {nextHistorical && <> · következő: <strong>{nextHistorical}</strong></>}
        </p>

        <div className="admin-actions">
          <button
            type="button"
            className="btn btn--primary"
            disabled={running || nextHistorical === null}
            onClick={() => runHistorical(1)}
          >
            1 szezon
          </button>
          <button
            type="button"
            className="btn"
            disabled={running || nextHistorical === null}
            onClick={() => runHistorical(5)}
          >
            5 szezon
          </button>
          <button
            type="button"
            className="btn"
            disabled={running || nextHistorical === null}
            onClick={() => runHistorical(13)}
          >
            13 szezon (kb. egy órányi keret)
          </button>
        </div>

        {/* Adott év újrafuttatása — hiányos szezonok pótlásához */}
        <div className="admin-actions" style={{ marginTop: "0.75rem" }}>
          <input
            type="number"
            min={JOLPICA_FIRST}
            max={JOLPICA_LAST}
            placeholder="Év"
            value={manualYear}
            onChange={(e) => setManualYear(e.target.value)}
            style={{ width: 100 }}
          />
          <button
            type="button"
            className="btn"
            disabled={running || !manualYear}
            onClick={() => runOneHistorical(Number(manualYear))}
          >
            Adott év újra
          </button>
          <span style={{ opacity: 0.6, fontSize: ".85rem", alignSelf: "center" }}>
            Hiányos szezon pótlásához (pl. 1994-2002 időmérő)
          </span>
        </div>
      </section>

      {/* ---------- OpenF1 ---------- */}
      <section style={{ marginTop: "2rem" }}>
        <h2>Modern adatok — {OPENF1_FIRST}-től</h2>
        <p style={{ opacity: 0.75 }}>
          Forrás: OpenF1. Naptár, versenyzők, csapatok, eredmények és időmérő.
        </p>
        <div className="admin-actions">
          {openF1Years.map((y) => (
            <button
              key={y}
              type="button"
              className="btn"
              disabled={running}
              onClick={() => runOpenF1([y])}
            >
              {y}
            </button>
          ))}
          <button
            type="button"
            className="btn btn--primary"
            disabled={running}
            onClick={() => runOpenF1(openF1Years)}
          >
            Mind
          </button>
        </div>

        {/* Egy futam — ha a teljes szezon túllépi a futásidő-korlátot */}
        <div className="admin-actions" style={{ marginTop: "0.75rem" }}>
          <input
            type="number"
            placeholder="Év"
            value={meetingYear}
            onChange={(e) => setMeetingYear(e.target.value)}
            style={{ width: 90 }}
          />
          <input
            type="number"
            placeholder="meeting_key"
            value={meetingKey}
            onChange={(e) => setMeetingKey(e.target.value)}
            style={{ width: 130 }}
          />
          <button
            type="button"
            className="btn"
            disabled={running || !meetingYear || !meetingKey}
            onClick={() => runOneMeeting(Number(meetingYear), Number(meetingKey))}
          >
            Egy futam
          </button>
          <span style={{ opacity: 0.6, fontSize: ".85rem", alignSelf: "center" }}>
            A kulcsokhoz: SELECT openf1_meeting_key, "Round", "Name" FROM grandprix WHERE "Year" = …
          </span>
        </div>
      </section>

      {running && (
        <button
          type="button"
          className="btn btn--danger"
          style={{ marginTop: "1rem" }}
          onClick={() => {
            stopRef.current = true;
          }}
        >
          Megállítás
        </button>
      )}

      {/* ---------- Futás naplója ---------- */}
      {lines.length > 0 && (
        <section style={{ marginTop: "2rem" }}>
          <h2>Futás</h2>
          <pre
            style={{
              background: "rgba(0,0,0,.35)",
              padding: "1rem",
              borderRadius: 6,
              maxHeight: 320,
              overflow: "auto",
              fontSize: ".85rem",
              lineHeight: 1.6,
            }}
          >
            {lines.map((l, i) => (
              <div
                key={i}
                style={{
                  color:
                    l.kind === "ok"
                      ? "#4ade80"
                      : l.kind === "error"
                        ? "#f87171"
                        : l.kind === "warn"
                          ? "#fbbf24"
                          : "inherit",
                }}
              >
                {l.text}
              </div>
            ))}
          </pre>
        </section>
      )}

      {/* ---------- Előzmények ---------- */}
      <section style={{ marginTop: "2rem" }}>
        <h2>Előzmények</h2>
        <table className="admin-table">
          <thead>
            <tr>
              <th>Forrás</th>
              <th>Feladat</th>
              <th>Szezon</th>
              <th>Állapot</th>
              <th>Sorok</th>
              <th>Kérések</th>
              <th>Indult</th>
              <th>Üzenet</th>
            </tr>
          </thead>
          <tbody>
            {log.map((l) => (
              <tr key={l.id}>
                <td>{l.provider}</td>
                <td>{l.task}</td>
                <td>{l.season ?? "—"}</td>
                <td
                  style={{
                    color:
                      l.status === "ok"
                        ? "#4ade80"
                        : l.status === "error"
                          ? "#f87171"
                          : "inherit",
                  }}
                >
                  {l.status}
                </td>
                <td>{l.rows_upserted}</td>
                <td>{l.requests_made}</td>
                <td>{new Date(l.started_at).toLocaleString("hu-HU")}</td>
                <td style={{ maxWidth: 320, fontSize: ".8rem", opacity: 0.8 }}>
                  {l.message ?? ""}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
};

export default AdminSync;
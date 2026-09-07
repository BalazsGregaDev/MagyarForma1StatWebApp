// ---------------------------------------------------------------------
//  supabase/functions/sync-f1/historical.ts
//
//  Történelmi szinkron 1950-2022, Jolpica forrásból.
//
//  FOLYTATHATÓ: szezononként fut, és a sync_log-ból tudja, hol tartott.
//  Ez nem kényelmi funkció, hanem kényszer: a Jolpica órás limitje
//  (500 kérés) mellett a teljes visszatöltés ~4 óra, ami egyetlen
//  Edge Function hívásba nem fér bele.
//
//  Hívás:
//    {"task":"historical","season":1950}   – egy adott szezon
//    {"task":"historical"}                 – folytatás a következővel
//    {"task":"historical","seasons":5}     – 5 szezon egymás után
// ---------------------------------------------------------------------

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import {
  JolpicaProvider,
  mapStatus,
  isClassified,
  qualiTimeToInterval,
  nationalityToCode,
  driverFullName,
  type ErgastRace,
  type ErgastDriver,
  type ErgastConstructor,
} from "./jolpica.ts";

/** Az OpenF1 2023-tól ad adatot, a Jolpica addig tölt. */
export const JOLPICA_LAST_SEASON = 2022;
export const JOLPICA_FIRST_SEASON = 1950;

/* =====================================================================
   AZONOSÍTÓ-GYORSÍTÓTÁRAK

   Egy szezon alatt ugyanaz a pilóta 20+ futamon szerepel. Cache nélkül
   minden soron külön SELECT menne az adatbázisba.
   ===================================================================== */
class RefCache {
  private drivers = new Map<string, number>();
  private teams = new Map<string, number>();
  private circuits = new Map<string, number>();

  constructor(private readonly db: SupabaseClient) {}

  async driver(d: ErgastDriver): Promise<number> {
    const hit = this.drivers.get(d.driverId);
    if (hit) return hit;

    const { data, error } = await this.db
      .from("drivers")
      .upsert(
        {
          jolpica_ref: d.driverId,
          Name: driverFullName(d),
          BirthDate: d.dateOfBirth || null,
          Nationality: d.nationality || null,
          country_code: nationalityToCode(d.nationality),
          Acronym: d.code || null,
          // A permanentNumber csak 2014-től állandó; korábban futamonként
          // változott, ezért nem írjuk a DriverNumber mezőbe.
          wikipedia_url: d.url || null,
          data_source: "jolpica",
        },
        { onConflict: "jolpica_ref" },
      )
      .select("DriverID")
      .single();

    if (error) throw new Error(`drivers upsert (${d.driverId}): ${error.message}`);
    const id = (data as { DriverID: number }).DriverID;
    this.drivers.set(d.driverId, id);
    return id;
  }

  async team(c: ErgastConstructor): Promise<number> {
    const hit = this.teams.get(c.constructorId);
    if (hit) return hit;

    const { data, error } = await this.db
      .from("constructors")
      .upsert(
        {
          jolpica_ref: c.constructorId,
          Name: c.name,
          Nationality: c.nationality || null,
          country_code: nationalityToCode(c.nationality),
          data_source: "jolpica",
        },
        { onConflict: "jolpica_ref" },
      )
      .select("ConstructorID")
      .single();

    if (error) throw new Error(`constructors upsert (${c.constructorId}): ${error.message}`);
    const id = (data as { ConstructorID: number }).ConstructorID;
    this.teams.set(c.constructorId, id);
    return id;
  }

  async circuit(r: ErgastRace): Promise<number> {
    const c = r.Circuit;
    const hit = this.circuits.get(c.circuitId);
    if (hit) return hit;

    const { data, error } = await this.db
      .from("circuits")
      .upsert(
        {
          jolpica_ref: c.circuitId,
          Name: c.circuitName,
          Location: c.Location?.locality || null,
          Country: c.Location?.country || null,
          latitude: c.Location?.lat ? Number(c.Location.lat) : null,
          longitude: c.Location?.long ? Number(c.Location.long) : null,
          data_source: "jolpica",
        },
        { onConflict: "jolpica_ref" },
      )
      .select("CircuitID")
      .single();

    if (error) throw new Error(`circuits upsert (${c.circuitId}): ${error.message}`);
    const id = (data as { CircuitID: number }).CircuitID;
    this.circuits.set(c.circuitId, id);
    return id;
  }
}

/* =====================================================================
   EGY SZEZON SZINKRONJA
   ===================================================================== */

export async function syncHistoricalSeason(
  db: SupabaseClient,
  api: JolpicaProvider,
  year: number,
): Promise<number> {
  const cache = new RefCache(db);
  let rows = 0;

  // --- 1. Futamnaptár + eredmények egy menetben ---------------------
  //  A /{year}/results végpont a futamokat IS visszaadja, tehát nem kell
  //  külön naptárt kérni. Ez szezononként egy kéréssel kevesebb.
  const races = await api.seasonResults(year);

  if (races.length === 0) {
    throw new Error(`A Jolpica nem adott vissza futamot ${year}-re.`);
  }

  // --- 2. Nagydíjak -------------------------------------------------
  const gpIdByRound = new Map<number, number>();

  for (const r of races) {
    const circuitId = await cache.circuit(r);
    const round = Number(r.round);

    const { data, error } = await db
      .from("grandprix")
      .upsert(
        {
          Name: r.raceName,
          Year: Number(r.season),
          Round: round,
          RaceDate: r.date || null,
          Country: r.Circuit?.Location?.country || null,
          CircuitID: circuitId,
          jolpica_round: round,
          data_source: "jolpica",
        },
        { onConflict: "Name,Year" },
      )
      .select("GrandPrixID")
      .single();

    if (error) throw new Error(`grandprix upsert (${r.raceName} ${year}): ${error.message}`);
    gpIdByRound.set(round, (data as { GrandPrixID: number }).GrandPrixID);
  }

  // --- 3. Futameredmények -------------------------------------------
  const entrySeen = new Set<string>();

  for (const r of races) {
    const gpId = gpIdByRound.get(Number(r.round));
    if (!gpId || !r.Results?.length) continue;

    const batch: Record<string, unknown>[] = [];

    for (const res of r.Results) {
      const driverId = await cache.driver(res.Driver);
      const teamId = await cache.team(res.Constructor);

      // FONTOS: az Ergast a kiesőket is rangsorolja (position = 18,
      // positionText = "R"). A mi sémánkban a kieső Position = NULL,
      // különben a pontszámító trigger pontot adna neki.
      const classified = isClassified(res.positionText);

      batch.push({
        GrandPrixID: gpId,
        DriverID: driverId,
        ConstructorID: teamId,
        Position: classified ? Number(res.position) : null,
        Grid: res.grid && Number(res.grid) > 0 ? Number(res.grid) : null,
        Laps: res.laps ? Number(res.laps) : null,
        TimeOrRetired: res.Time?.time ?? res.status ?? null,
        FastestLap: res.FastestLap?.rank === "1",
        GpOrSprint: true,
        status_id: mapStatus(res.status ?? "", res.positionText),
        is_classified: classified,
        car_number: res.number ? Number(res.number) : null,
        data_source: "jolpica",

        // A FORRÁS PONTJA A MÉRVADÓ (1950-2022). Az Ergast a hivatalos
        // végeredményt adja, amit a trigger nem tud reprodukálni:
        // leggyorsabb kör 1950-59 (nincs az adatban), megosztott
        // leggyorsabb kör, félpontos futamok. A seasons.trust_source_points
        // kapcsoló miatt a trigger ezekben az években nem írja felül.
        Points: res.points ? Number(res.points) : 0,
      });

      // Nevezés (versenyző + csapat + szezon)
      const key = `${driverId}:${teamId}`;
      if (!entrySeen.has(key)) {
        entrySeen.add(key);
        await db.from("season_entries").upsert(
          {
            DriverID: driverId,
            ConstructorID: teamId,
            year,
            car_number: res.number ? Number(res.number) : null,
          },
          { onConflict: "DriverID,ConstructorID,year,from_round" },
        );
      }
    }

    // --- MEGOSZTOTT AUTÓK (1950-1957) ---------------------------------
    // Az Ergast nem jelöli külön, hogy két pilóta ugyanazt a kocsit
    // vezette — csak annyi látszik, hogy ugyanaz a pozíció kétszer
    // szerepel. Közös csoportazonosítót adunk nekik, különben a
    // race_result_unique_position index elutasítja a második sort.
    const byPosition = new Map<number, Record<string, unknown>[]>();
    for (const row of batch) {
      const pos = row.Position as number | null;
      if (pos == null) continue;
      const list = byPosition.get(pos) ?? [];
      list.push(row);
      byPosition.set(pos, list);
    }

    let group = 0;
    for (const sameSpot of byPosition.values()) {
      if (sameSpot.length > 1) {
        group++;
        for (const row of sameSpot) row.shared_drive_group = group;
      }
    }

    // --- AZONOS VERSENYZŐ TÖBBSZÖR (Indianapolis 500, 1950-1960) ------
    // A Postgres egyetlen ON CONFLICT parancson belül nem írhat kétszer
    // ugyanarra a kulcsra. Elsődlegesen a több pont dönt, azonos pontnál
    // a jobb helyezés.
    const bestByDriver = new Map<number, Record<string, unknown>>();
    for (const row of batch) {
      const key = row.DriverID as number;
      const prev = bestByDriver.get(key);
      if (!prev) {
        bestByDriver.set(key, row);
        continue;
      }
      const pNew = (row.Points as number) ?? 0;
      const pOld = (prev.Points as number) ?? 0;
      if (pNew > pOld) {
        bestByDriver.set(key, row);
      } else if (pNew === pOld) {
        const a = (row.Position as number | null) ?? 999;
        const b = (prev.Position as number | null) ?? 999;
        if (a < b) bestByDriver.set(key, row);
      }
    }
    const deduped = [...bestByDriver.values()];

    const { error } = await db
      .from("race_result")
      .upsert(deduped, { onConflict: "GrandPrixID,DriverID,GpOrSprint" });

    if (error) throw new Error(`race_result upsert (${r.raceName}): ${error.message}`);
    rows += deduped.length;
  }

  // --- 4. Időmérő (az Ergast 1994-től tartalmazza) -------------------
  if (year >= 1994) {
    try {
      const quali = await api.seasonQualifying(year);

      for (const r of quali) {
        const gpId = gpIdByRound.get(Number(r.round));
        if (!gpId || !r.QualifyingResults?.length) continue;

        const batch: Record<string, unknown>[] = [];
        for (const q of r.QualifyingResults) {
          batch.push({
            GrandPrixID: gpId,
            DriverID: await cache.driver(q.Driver),
            ConstructorID: await cache.team(q.Constructor),
            GridPosition: Number(q.position),
            Q1Time: qualiTimeToInterval(q.Q1),
            Q2Time: qualiTimeToInterval(q.Q2),
            Q3Time: qualiTimeToInterval(q.Q3),
          });
        }

        const { error } = await db
          .from("qualifying_result")
          .upsert(batch, { onConflict: "GrandPrixID,DriverID" });
        if (error) throw new Error(`qualifying_result (${r.raceName}): ${error.message}`);
        rows += batch.length;
      }
    } catch (e) {
      // Az időmérő hiánya ne buktassa el az egész szezont — a
      // futameredmények már bementek. De KERÜLJÖN A NAPLÓBA: egy néma
      // console.warn miatt 73 szezonon át elveszett az összes időmérős
      // adat, és csak a függvény logjában látszott.
      await logSubtaskError(db, year, "historical-quali", e);
    }
  }

  // --- 5. Sprint (2021-től) -----------------------------------------
  if (year >= 2021) {
    try {
      const sprints = await api.seasonSprint(year);
      for (const r of sprints) {
        const gpId = gpIdByRound.get(Number(r.round));
        if (!gpId || !r.SprintResults?.length) continue;

        const batch: Record<string, unknown>[] = [];
        for (const res of r.SprintResults) {
          const classified = isClassified(res.positionText);
          batch.push({
            GrandPrixID: gpId,
            DriverID: await cache.driver(res.Driver),
            ConstructorID: await cache.team(res.Constructor),
            Position: classified ? Number(res.position) : null,
            Grid: res.grid ? Number(res.grid) : null,
            Laps: res.laps ? Number(res.laps) : null,
            TimeOrRetired: res.Time?.time ?? res.status ?? null,
            FastestLap: false,
            GpOrSprint: false,
            status_id: mapStatus(res.status ?? "", res.positionText),
            is_classified: classified,
            data_source: "jolpica",
            Points: res.points ? Number(res.points) : 0,
          });
        }
        const { error } = await db
          .from("race_result")
          .upsert(batch, { onConflict: "GrandPrixID,DriverID,GpOrSprint" });
        if (error) throw new Error(`sprint (${r.raceName}): ${error.message}`);
        rows += batch.length;
      }
    } catch (e) {
      await logSubtaskError(db, year, "historical-sprint", e);
    }
  }

  return rows;
}

/* =====================================================================
   RÉSZFELADAT-HIBÁK NAPLÓZÁSA

   Az időmérő és a sprint hibája nem buktatja el a szezont, de nem is
   veszhet el némán. Így az /admin/sync előzmények táblájában látszik.
   ===================================================================== */

async function logSubtaskError(
  db: SupabaseClient,
  year: number,
  task: string,
  e: unknown,
): Promise<void> {
  const msg = e instanceof Error ? e.message : String(e);
  console.warn(`${task} kihagyva ${year}: ${msg}`);
  try {
    await db.from("sync_log").insert({
      provider: "jolpica",
      task,
      season: year,
      status: "error",
      rows_upserted: 0,
      requests_made: 0,
      message: msg,
      finished_at: new Date().toISOString(),
    });
  } catch {
    /* a naplózás hibája ne buktassa el a szinkront */
  }
}

/* =====================================================================
   FOLYTATÁS: hol tartottunk?
   ===================================================================== */

export async function nextUnsyncedSeason(db: SupabaseClient): Promise<number | null> {
  const { data } = await db
    .from("sync_log")
    .select("season")
    .eq("provider", "jolpica")
    .eq("task", "historical")
    .eq("status", "ok")
    .order("season", { ascending: false })
    .limit(1);

  const last = (data as { season: number }[] | null)?.[0]?.season;
  const next = last == null ? JOLPICA_FIRST_SEASON : last + 1;
  return next > JOLPICA_LAST_SEASON ? null : next;
}
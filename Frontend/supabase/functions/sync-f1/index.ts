// ---------------------------------------------------------------------
//  supabase/functions/sync-f1/index.ts
//
//  OpenF1 -> Supabase szinkron.
//
//  ALAPELVEK:
//
//  1. ÜTEMEZETT, NEM KÉRÉSENKÉNTI. A frontend soha nem hívja az OpenF1-et.
//     A rate limit 3 req/s — pár párhuzamos látogató elvinné. Így a limit
//     egyetlen háttérfolyamatra korlátozódik, nem a látogatók számával
//     skálázódik.
//
//  2. MINDEN MŰVELET UPSERT. A szinkron bármikor újrafuttatható, nem
//     duplikál. Ezt az openf1_* egyedi indexek teszik lehetővé
//     (03_openf1_migracio.sql).
//
//  3. NINCS TELEMETRIA. A car_data (~3,7 Hz) és a location végpont
//     egyetlen futamon ~400 000 sort adna, ~40 MB-ot. A Supabase free
//     tier 500 MB-ját egy hétvége szétfeszítené.
//
//  4. A PONTOKAT NEM ÍRJUK. A b_assign_points trigger számolja a
//     helyezésből, az évből és a sprint jelzőből.
//
//  HÍVÁS:
//    POST /functions/v1/sync-f1
//    Authorization: Bearer <SERVICE_ROLE_KEY>
//    { "task": "results", "season": 2026 }
//
//  Taskok:
//    "calendar" – meetings + sessions -> grandprix, circuits
//    "drivers"  – versenyzők és csapatok (csapatszínnel együtt)
//    "results"  – futam- és sprinteredmények + rajtrács + időmérő
//    "detail"   – köridők, boxkiállások, stintek, időjárás
//    "latest"   – a legutóbbi meeting mindene (futamhétvégére)
//    "full"     – calendar + drivers + results egy menetben
// ---------------------------------------------------------------------
import { createClient, type SupabaseClient } from "jsr:@supabase/supabase-js@2";
import {
  OpenF1Provider,
  normaliseColour,
  secondsToInterval,
  qualiTime,
  retirementReason,
  type F1DataProvider,
  type Session,
} from "./providers.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Task = "calendar" | "drivers" | "results" | "detail" | "latest" | "full";

interface Body {
  task?: Task;
  season?: number;
  /** Csak egy adott meetinget szinkronizál */
  meetingKey?: number;
  /** "detail" taskhoz: köridők és időjárás is (lassabb, több kérés) */
  includeLaps?: boolean;
}

/* ===================================================================== */

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  // Csak a service_role kulccsal hívható. Az anon kulccsal érkező kérést
  // elutasítjuk: a szinkron ír az adatbázisba.
  const auth = req.headers.get("Authorization") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!serviceKey || !auth.includes(serviceKey)) {
    return json({ error: "Jogosulatlan. A szinkron csak a secret kulccsal hívható." }, 401);
  }

  const body: Body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
  const task: Task = body.task ?? "results";
  const season = body.season ?? new Date().getUTCFullYear();

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    serviceKey,
    { auth: { persistSession: false } },
  );

  const provider = new OpenF1Provider(Deno.env.get("OPENF1_API_KEY") ?? undefined);

  if (season < provider.earliestSeason) {
    return json(
      {
        error: `Az OpenF1 ${provider.earliestSeason}-tól ad adatot. A ${season}-es szezonhoz Jolpica kellene.`,
      },
      400,
    );
  }

  const log = await startLog(supabase, provider.name, task, season);
  let upserted = 0;

  try {
    switch (task) {
      case "calendar":
        upserted = await syncCalendar(supabase, provider, season);
        break;
      case "drivers":
        upserted = await syncDrivers(supabase, provider, season);
        break;
      case "results":
        upserted = await syncResults(supabase, provider, season, body.meetingKey);
        break;
      case "detail":
        upserted = await syncDetail(supabase, provider, season, body.meetingKey, body.includeLaps);
        break;
      case "latest":
        upserted = await syncLatest(supabase, provider);
        break;
      case "full":
        upserted =
          (await syncCalendar(supabase, provider, season)) +
          (await syncDrivers(supabase, provider, season)) +
          (await syncResults(supabase, provider, season));
        break;
      default:
        throw new Error(`Ismeretlen task: ${task}`);
    }

    await finishLog(supabase, log, "ok", upserted, provider.requestCount);
    return json({ task, season, upserted, requests: provider.requestCount });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await finishLog(supabase, log, "error", upserted, provider.requestCount, msg);
    return json({ task, season, upserted, error: msg }, 500);
  }
});

/* =====================================================================
   TASK: CALENDAR – meetings + sessions -> circuits, grandprix
   ===================================================================== */

async function syncCalendar(
  db: SupabaseClient,
  api: F1DataProvider,
  season: number,
): Promise<number> {
  const meetings = await api.meetings(season);
  let n = 0;

  for (const m of meetings) {
    // --- pálya ---
    const { data: circuit } = await db
      .from("circuits")
      .upsert(
        {
          openf1_circuit_key: m.circuit_key,
          Name: m.circuit_short_name,
          Location: m.location,
          Country: m.country_name,
        },
        { onConflict: "openf1_circuit_key" },
      )
      .select("CircuitID")
      .single();

    // --- sessionök: melyik a futam, a sprint, az időmérő ---
    const sessions = await api.sessions(m.meeting_key);
    const race = pick(sessions, "Race");
    const sprint = pick(sessions, "Sprint");
    const quali = pick(sessions, "Qualifying");

    const { error } = await db.from("grandprix").upsert(
      {
        openf1_meeting_key: m.meeting_key,
        openf1_session_key: race?.session_key ?? null,
        openf1_sprint_key: sprint?.session_key ?? null,
        openf1_quali_key: quali?.session_key ?? null,
        Name: m.meeting_name,
        Country: m.country_name,
        Year: m.year,
        CircuitID: circuit?.CircuitID ?? null,
        RaceDate: (race?.date_start ?? m.date_start).slice(0, 10),
      },
      { onConflict: "openf1_meeting_key" },
    );
    if (error) throw new Error(`grandprix upsert: ${error.message}`);
    n++;
  }

  // A fordulószámot a dátum sorrendje adja — az OpenF1 nem közli külön.
  await renumberRounds(db, season);
  return n;
}

/** A session_name pontos egyezés; a "Sprint Qualifying" nem Sprint. */
function pick(sessions: Session[], name: string): Session | undefined {
  return sessions.find((s) => s.session_name === name);
}

async function renumberRounds(db: SupabaseClient, season: number) {
  const { data } = await db
    .from("grandprix")
    .select("GrandPrixID, RaceDate")
    .eq("Year", season)
    .order("RaceDate", { ascending: true });

  if (!data) return;
  for (let i = 0; i < data.length; i++) {
    await db
      .from("grandprix")
      .update({ Round: i + 1 })
      .eq("GrandPrixID", (data[i] as { GrandPrixID: number }).GrandPrixID);
  }
}

/* =====================================================================
   TASK: DRIVERS – versenyzők és csapatok
   ===================================================================== */

async function syncDrivers(
  db: SupabaseClient,
  api: F1DataProvider,
  season: number,
): Promise<number> {
  // A legutóbbi futam mezőnye a mérvadó az aktuális csapatokra.
  const { data: races } = await db
    .from("grandprix")
    .select("openf1_session_key")
    .eq("Year", season)
    .not("openf1_session_key", "is", null)
    .order("RaceDate", { ascending: false })
    .limit(1);

  const sessionKey = (races?.[0] as { openf1_session_key: number } | undefined)
    ?.openf1_session_key;
  if (!sessionKey) throw new Error("Nincs futam session_key. Futtasd előbb a 'calendar' taskot.");

  const drivers = await api.drivers(sessionKey);
  let n = 0;

  for (const d of drivers) {
    const colour = normaliseColour(d.team_colour);

    const { data: team } = await db
      .from("constructors")
      .upsert(
        {
          openf1_team_name: d.team_name,
          Name: d.team_name,
          TeamColour: colour,
        },
        { onConflict: "openf1_team_name" },
      )
      .select("ConstructorID")
      .single();

    // FIGYELEM: a headshot_url mezőt SZÁNDÉKOSAN nem vesszük át.
    // Az a media.formula1.com-ra mutat, és szerzői jogvédett
    // (lásd kephasznalat_es_jogok.md). Helyette a DriverAvatar
    // komponens generál SVG-t a rajtszámból és a csapatszínből.
    const { error } = await db.from("drivers").upsert(
      {
        openf1_driver_number: d.driver_number,
        DriverNumber: d.driver_number,
        Name: d.full_name,
        Acronym: d.name_acronym,
        Nationality: d.country_code,
        ConstructorID: team?.ConstructorID ?? null,
      },
      { onConflict: "openf1_driver_number" },
    );
    if (error) throw new Error(`drivers upsert: ${error.message}`);
    n++;
  }
  return n;
}

/* =====================================================================
   TASK: RESULTS – futam, sprint, rajtrács, időmérő
   ===================================================================== */

interface RaceRow {
  GrandPrixID: number;
  openf1_session_key: number | null;
  openf1_sprint_key: number | null;
  openf1_quali_key: number | null;
}

async function syncResults(
  db: SupabaseClient,
  api: F1DataProvider,
  season: number,
  meetingKey?: number,
): Promise<number> {
  let q = db
    .from("grandprix")
    .select("GrandPrixID, openf1_session_key, openf1_sprint_key, openf1_quali_key")
    .eq("Year", season);
  if (meetingKey) q = q.eq("openf1_meeting_key", meetingKey);

  const { data, error } = await q;
  if (error) throw new Error(`grandprix lekérdezés: ${error.message}`);

  const driverMap = await loadDriverMap(db);
  let n = 0;

  for (const gp of (data ?? []) as RaceRow[]) {
    if (gp.openf1_session_key) {
      n += await upsertRaceResults(db, api, gp, gp.openf1_session_key, true, driverMap);
    }
    if (gp.openf1_sprint_key) {
      n += await upsertRaceResults(db, api, gp, gp.openf1_sprint_key, false, driverMap);
    }
    if (gp.openf1_quali_key) {
      n += await upsertQualifying(db, api, gp, gp.openf1_quali_key, driverMap);
    }
  }
  return n;
}

/** driver_number -> { DriverID, ConstructorID } */
async function loadDriverMap(db: SupabaseClient) {
  const { data } = await db
    .from("drivers")
    .select("DriverID, ConstructorID, openf1_driver_number")
    .not("openf1_driver_number", "is", null);

  const map = new Map<number, { id: number; team: number | null }>();
  for (const d of (data ?? []) as {
    DriverID: number;
    ConstructorID: number | null;
    openf1_driver_number: number;
  }[]) {
    map.set(d.openf1_driver_number, { id: d.DriverID, team: d.ConstructorID });
  }
  return map;
}

async function upsertRaceResults(
  db: SupabaseClient,
  api: F1DataProvider,
  gp: RaceRow,
  sessionKey: number,
  isRace: boolean,
  drivers: Map<number, { id: number; team: number | null }>,
): Promise<number> {
  const [results, grid] = await Promise.all([
    api.sessionResult(sessionKey),
    api.startingGrid(sessionKey).catch(() => []), // régebbi sessionöknél hiányozhat
  ]);

  const gridMap = new Map(grid.map((g) => [g.driver_number, g.position]));

  // A leggyorsabb kör kiszámítása: a legrövidebb lap_duration a futamon.
  // Az OpenF1 session_result nem jelzi külön.
  let fastestDriver: number | null = null;
  if (isRace) {
    try {
      const laps = await api.laps(sessionKey);
      let best = Infinity;
      for (const l of laps) {
        if (l.lap_duration && l.lap_duration > 0 && l.lap_duration < best) {
          best = l.lap_duration;
          fastestDriver = l.driver_number;
        }
      }
    } catch {
      // Ha nincs köridő-adat, a leggyorsabb kör jelző marad hamis.
    }
  }

  const rows = results
    .filter((r) => drivers.has(r.driver_number))
    .map((r) => {
      const d = drivers.get(r.driver_number)!;
      const finished = !r.dnf && !r.dns && !r.dsq && r.position != null;
      return {
        GrandPrixID: gp.GrandPrixID,
        DriverID: d.id,
        ConstructorID: d.team,
        // Kiesőnél NULL — így a trigger 0 pontot ad.
        Position: finished ? r.position : null,
        Grid: gridMap.get(r.driver_number) ?? null,
        Laps: r.number_of_laps,
        TimeOrRetired: retirementReason(r),
        FastestLap: isRace && r.driver_number === fastestDriver,
        GpOrSprint: isRace,
        // Points: SZÁNDÉKOSAN nincs — a b_assign_points trigger számolja.
      };
    })
    .filter((r) => r.ConstructorID != null);

  if (!rows.length) return 0;

  const { error } = await db
    .from("race_result")
    .upsert(rows, { onConflict: "GrandPrixID,DriverID,GpOrSprint" });

  if (error) throw new Error(`race_result upsert (session ${sessionKey}): ${error.message}`);
  return rows.length;
}

async function upsertQualifying(
  db: SupabaseClient,
  api: F1DataProvider,
  gp: RaceRow,
  sessionKey: number,
  drivers: Map<number, { id: number; team: number | null }>,
): Promise<number> {
  const results = await api.sessionResult(sessionKey);

  // Ez váltja ki a QualifyingResultSeeder shuffle()-jét, ami eddig
  // VÉLETLENSZÁM-alapú, kitalált rajthelyeket generált
  // (javitando_funkciok.md #21).
  const rows = results
    .filter((r) => drivers.has(r.driver_number) && r.position != null)
    .map((r) => {
      const d = drivers.get(r.driver_number)!;
      return {
        GrandPrixID: gp.GrandPrixID,
        DriverID: d.id,
        ConstructorID: d.team,
        GridPosition: r.position,
        Q1Time: secondsToInterval(qualiTime(r.duration, 0)),
        Q2Time: secondsToInterval(qualiTime(r.duration, 1)),
        Q3Time: secondsToInterval(qualiTime(r.duration, 2)),
      };
    });

  if (!rows.length) return 0;

  const { error } = await db
    .from("qualifying_result")
    .upsert(rows, { onConflict: "GrandPrixID,DriverID" });

  if (error) throw new Error(`qualifying_result upsert: ${error.message}`);
  return rows.length;
}

/* =====================================================================
   TASK: DETAIL – köridők, box, stintek, időjárás
   ===================================================================== */

async function syncDetail(
  db: SupabaseClient,
  api: F1DataProvider,
  season: number,
  meetingKey?: number,
  includeLaps = true,
): Promise<number> {
  let q = db
    .from("grandprix")
    .select("GrandPrixID, openf1_session_key")
    .eq("Year", season)
    .not("openf1_session_key", "is", null);
  if (meetingKey) q = q.eq("openf1_meeting_key", meetingKey);

  const { data } = await q;
  const drivers = await loadDriverMap(db);
  let n = 0;

  for (const gp of (data ?? []) as RaceRow[]) {
    const sk = gp.openf1_session_key!;

    // --- stintek (gumistratégia) ---
    const stints = await api.stints(sk);
    const stintRows = stints
      .filter((s) => drivers.has(s.driver_number))
      .map((s) => ({
        GrandPrixID: gp.GrandPrixID,
        DriverID: drivers.get(s.driver_number)!.id,
        session_key: sk,
        stint_number: s.stint_number,
        compound: s.compound ?? "UNKNOWN",
        lap_start: s.lap_start,
        lap_end: s.lap_end,
        tyre_age_at_start: s.tyre_age_at_start,
      }));
    if (stintRows.length) {
      const { error } = await db
        .from("stints")
        .upsert(stintRows, { onConflict: "session_key,DriverID,stint_number" });
      if (error) throw new Error(`stints: ${error.message}`);
      n += stintRows.length;
    }

    // --- boxkiállások ---
    const pits = await api.pitStops(sk);
    const pitRows = pits
      .filter((p) => drivers.has(p.driver_number))
      .map((p) => ({
        GrandPrixID: gp.GrandPrixID,
        DriverID: drivers.get(p.driver_number)!.id,
        session_key: sk,
        lap_number: p.lap_number,
        pit_duration: p.pit_duration,
        date: p.date,
      }));
    if (pitRows.length) {
      const { error } = await db
        .from("pit_stops")
        .upsert(pitRows, { onConflict: "session_key,DriverID,lap_number" });
      if (error) throw new Error(`pit_stops: ${error.message}`);
      n += pitRows.length;
    }

    // --- köridők (a legnagyobb tétel: ~1 200 sor/futam) ---
    if (includeLaps) {
      const laps = await api.laps(sk);
      const lapRows = laps
        .filter((l) => drivers.has(l.driver_number))
        .map((l) => ({
          GrandPrixID: gp.GrandPrixID,
          DriverID: drivers.get(l.driver_number)!.id,
          session_key: sk,
          lap_number: l.lap_number,
          lap_duration: l.lap_duration,
          duration_sector_1: l.duration_sector_1,
          duration_sector_2: l.duration_sector_2,
          duration_sector_3: l.duration_sector_3,
          st_speed: l.st_speed,
          i1_speed: l.i1_speed,
          i2_speed: l.i2_speed,
          is_pit_out_lap: l.is_pit_out_lap ?? false,
          date_start: l.date_start,
        }));

      // 500-as adagokban, hogy ne fusson ki a memóriából és a kérésméretből
      for (let i = 0; i < lapRows.length; i += 500) {
        const { error } = await db
          .from("laps")
          .upsert(lapRows.slice(i, i + 500), {
            onConflict: "session_key,DriverID,lap_number",
          });
        if (error) throw new Error(`laps: ${error.message}`);
      }
      n += lapRows.length;

      // --- időjárás ---
      const weather = await api.weather(sk);
      const wRows = weather.map((w) => ({
        GrandPrixID: gp.GrandPrixID,
        session_key: sk,
        date: w.date,
        air_temperature: w.air_temperature,
        track_temperature: w.track_temperature,
        humidity: w.humidity,
        pressure: w.pressure,
        wind_speed: w.wind_speed,
        wind_direction: w.wind_direction,
        rainfall: w.rainfall,
      }));
      if (wRows.length) {
        const { error } = await db
          .from("weather")
          .upsert(wRows, { onConflict: "session_key,date" });
        if (error) throw new Error(`weather: ${error.message}`);
        n += wRows.length;
      }
    }
  }
  return n;
}

/* =====================================================================
   TASK: LATEST – a legutóbbi futamhétvége (hétvégi cronhoz)
   ===================================================================== */

async function syncLatest(db: SupabaseClient, api: F1DataProvider): Promise<number> {
  const season = new Date().getUTCFullYear();
  const meetings = await api.meetings(season);
  if (!meetings.length) return 0;

  const latest = meetings[meetings.length - 1];

  await syncCalendar(db, api, season);
  await syncDrivers(db, api, season);
  return await syncResults(db, api, season, latest.meeting_key);
}

/* =====================================================================
   NAPLÓZÁS
   ===================================================================== */

async function startLog(db: SupabaseClient, provider: string, task: string, season: number) {
  const { data } = await db
    .from("sync_log")
    .insert({ provider, task, season, status: "running" })
    .select("id")
    .single();
  return (data as { id: number } | null)?.id ?? null;
}

async function finishLog(
  db: SupabaseClient,
  id: number | null,
  status: string,
  rows: number,
  requests: number,
  message?: string,
) {
  if (!id) return;
  await db
    .from("sync_log")
    .update({
      status,
      rows_upserted: rows,
      requests_made: requests,
      message: message ?? null,
      finished_at: new Date().toISOString(),
    })
    .eq("id", id);
}

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}
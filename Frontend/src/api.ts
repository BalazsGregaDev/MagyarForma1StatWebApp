// ---------------------------------------------------------------------
//  src/lib/api.ts
//
//  Adathozzáférési réteg. Ez váltja ki az ÖSSZES korábbi fetch() hívást.
//
//  A komponensekben így néz ki a csere:
//
//    RÉGI:
//      fetch(`${API_BASE}/driver/`)
//        .then(r => r.json())
//        .then(setDrivers);
//
//    ÚJ:
//      api.drivers.list().then(setDrivers);
//
//  Minden metódus hibát dob (throw) sikertelenség esetén, hogy a hívó
//  try/catch-csel kezelhesse — a régi kódban a hibák néma console.error-ban
//  végződtek, és a felhasználó üres oldalt látott.
// ---------------------------------------------------------------------
import { supabase, readableError } from "./supabaseClient";
import type {
  Circuit,
  Constructor,
  Driver,
  GrandPrix,
  RaceResult,
  QualifyingResult,
  DriverStanding,
  ConstructorStanding,
  DriverStatsResult,
  ConstructorStatsResult,
} from "./database.types";

/** Egységes hibakezelés a PostgREST válaszaihoz. */
function unwrap<T>(res: { data: T | null; error: unknown }): T {
  if (res.error) throw new Error(readableError(res.error));
  if (res.data === null) throw new Error("A keresett rekord nem található.");
  return res.data;
}

// =====================================================================
//  VERSENYZŐK
// =====================================================================
export const drivers = {
  async list(): Promise<Driver[]> {
    return unwrap(
      await supabase
        .from("drivers")
        .select("*")
        .order("Name", { ascending: true }),
    );
  },

  /** Versenyző a csapatával együtt – egyetlen kérésben.
   *  A régi driverDetail.tsx két külön fetch-et indított egymás után. */
  async getWithConstructor(id: number) {
    const data = unwrap(
      await supabase
        .from("drivers")
        .select("*, constructor:constructors(*)")
        .eq("DriverID", id)
        .single(),
    );
    return data as unknown as Driver & { constructor: Constructor | null };
  },

  async get(id: number): Promise<Driver> {
    return unwrap(
      await supabase.from("drivers").select("*").eq("DriverID", id).single(),
    );
  },

  async byConstructor(constructorId: number): Promise<Driver[]> {
    return unwrap(
      await supabase
        .from("drivers")
        .select("*")
        .eq("ConstructorID", constructorId)
        .order("Name"),
    );
  },

  async create(payload: Partial<Driver>): Promise<Driver> {
    return unwrap(
      await supabase
        .from("drivers")
        .insert(payload as any)
        .select()
        .single(),
    );
  },

  async update(id: number, payload: Partial<Driver>): Promise<Driver> {
    return unwrap(
      await supabase
        .from("drivers")
        .update(payload as any)
        .eq("DriverID", id)
        .select()
        .single(),
    );
  },

  async remove(id: number): Promise<void> {
    const { error } = await supabase
      .from("drivers")
      .delete()
      .eq("DriverID", id);
    if (error) throw new Error(readableError(error));
  },
};

// =====================================================================
//  CSAPATOK
// =====================================================================
export const constructors = {
  async list(): Promise<Constructor[]> {
    return unwrap(
      await supabase.from("constructors").select("*").order("Name"),
    );
  },

  /** Csapat a jelenlegi pilótáival együtt. */
  async getWithDrivers(id: number) {
    const data = unwrap(
      await supabase
        .from("constructors")
        .select("*, drivers(*)")
        .eq("ConstructorID", id)
        .single(),
    );
    return data as unknown as Constructor & { drivers: Driver[] };
  },

  async get(id: number): Promise<Constructor> {
    return unwrap(
      await supabase
        .from("constructors")
        .select("*")
        .eq("ConstructorID", id)
        .single(),
    );
  },

  async create(payload: Partial<Constructor>): Promise<Constructor> {
    return unwrap(
      await supabase
        .from("constructors")
        .insert(payload as any)
        .select()
        .single(),
    );
  },

  async update(
    id: number,
    payload: Partial<Constructor>,
  ): Promise<Constructor> {
    return unwrap(
      await supabase
        .from("constructors")
        .update(payload as any)
        .eq("ConstructorID", id)
        .select()
        .single(),
    );
  },

  async remove(id: number): Promise<void> {
    const { error } = await supabase
      .from("constructors")
      .delete()
      .eq("ConstructorID", id);
    if (error) throw new Error(readableError(error));
  },
};

// =====================================================================
//  PÁLYÁK
// =====================================================================
export const circuits = {
  async list(): Promise<Circuit[]> {
    return unwrap(await supabase.from("circuits").select("*").order("Name"));
  },

  /** Pálya az ott rendezett futamokkal. */
  async getWithRaces(id: number) {
    const data = unwrap(
      await supabase
        .from("circuits")
        .select("*, grandprix(*)")
        .eq("CircuitID", id)
        .single(),
    );
    return data as unknown as Circuit & { grandprix: GrandPrix[] };
  },

  async get(id: number): Promise<Circuit> {
    return unwrap(
      await supabase.from("circuits").select("*").eq("CircuitID", id).single(),
    );
  },

  async create(payload: Partial<Circuit>): Promise<Circuit> {
    return unwrap(
      await supabase
        .from("circuits")
        .insert(payload as any)
        .select()
        .single(),
    );
  },

  async update(id: number, payload: Partial<Circuit>): Promise<Circuit> {
    return unwrap(
      await supabase
        .from("circuits")
        .update(payload as any)
        .eq("CircuitID", id)
        .select()
        .single(),
    );
  },

  async remove(id: number): Promise<void> {
    const { error } = await supabase
      .from("circuits")
      .delete()
      .eq("CircuitID", id);
    if (error) throw new Error(readableError(error));
  },
};

// =====================================================================
//  NAGYDÍJAK
// =====================================================================
export const grandPrix = {
  async list(year?: number): Promise<GrandPrix[]> {
    let q = supabase.from("grandprix").select("*");
    if (year) q = q.eq("Year", year);
    return unwrap(
      await q
        .order("Year", { ascending: false })
        .order("Round", { ascending: true }),
    );
  },

  /** Futam a pályával és a győztessel – a régi kód három kérést indított. */
  async getFull(id: number) {
    const data = unwrap(
      await supabase
        .from("grandprix")
        .select(
          "*, circuit:circuits(*), winner:drivers!grandprix_winnerdriverid_fkey(*)",
        )
        .eq("GrandPrixID", id)
        .single(),
    );
    return data as unknown as GrandPrix & {
      circuit: Circuit | null;
      winner: Driver | null;
    };
  },

  /** Egy futam teljes eredménylistája, versenyzővel és csapattal. */
  async results(grandPrixId: number, sprint = false) {
    const data = unwrap(
      await supabase
        .from("race_result")
        .select("*, driver:drivers(*), constructor:constructors(*)")
        .eq("GrandPrixID", grandPrixId)
        .eq("GpOrSprint", !sprint ? true : false)
        .order("Position", { ascending: true, nullsFirst: false }),
    );
    return data as unknown as (RaceResult & {
      driver: Driver;
      constructor: Constructor;
    })[];
  },

  /** Elérhető szezonok – a szezonválasztó dropdownhoz. */
  async seasons(): Promise<number[]> {
    const data = unwrap(
      await supabase
        .from("grandprix")
        .select("Year")
        .order("Year", { ascending: false }),
    );
    return Array.from(new Set((data as { Year: number }[]).map((r) => r.Year)));
  },

  async create(payload: Partial<GrandPrix>): Promise<GrandPrix> {
    return unwrap(
      await supabase
        .from("grandprix")
        .insert(payload as any)
        .select()
        .single(),
    );
  },

  async update(id: number, payload: Partial<GrandPrix>): Promise<GrandPrix> {
    // A WinnerDriverID-t az adatbázis triggere kezeli, kézzel nem írjuk.
    const { WinnerDriverID, ...safe } = payload as any;
    return unwrap(
      await supabase
        .from("grandprix")
        .update(safe)
        .eq("GrandPrixID", id)
        .select()
        .single(),
    );
  },

  async remove(id: number): Promise<void> {
    const { error } = await supabase
      .from("grandprix")
      .delete()
      .eq("GrandPrixID", id);
    if (error) throw new Error(readableError(error));
  },
};

// =====================================================================
//  FUTAMEREDMÉNYEK
// =====================================================================
export const raceResults = {
  async list() {
    const data = unwrap(
      await supabase
        .from("race_result")
        .select(
          "*, driver:drivers(*), constructor:constructors(*), grandPrix:grandprix(*)",
        )
        .order("GrandPrixID")
        .order("Position", { ascending: true, nullsFirst: false }),
    );
    return data as unknown as (RaceResult & {
      driver: Driver;
      constructor: Constructor;
      grandPrix: GrandPrix;
    })[];
  },

  /** FONTOS: a Points mezőt NE küldd – a b_assign_points trigger számolja. */
  async create(payload: Partial<RaceResult>): Promise<RaceResult> {
    const { Points, ...safe } = payload as any;
    return unwrap(
      await supabase.from("race_result").insert(safe).select().single(),
    );
  },

  async update(id: number, payload: Partial<RaceResult>): Promise<RaceResult> {
    const { Points, ...safe } = payload as any;
    return unwrap(
      await supabase
        .from("race_result")
        .update(safe)
        .eq("ResultID", id)
        .select()
        .single(),
    );
  },

  async remove(id: number): Promise<void> {
    const { error } = await supabase
      .from("race_result")
      .delete()
      .eq("ResultID", id);
    if (error) throw new Error(readableError(error));
  },
};

// =====================================================================
//  IDŐMÉRŐS EREDMÉNYEK
// =====================================================================
export const qualifying = {
  async byGrandPrix(grandPrixId: number) {
    const data = unwrap(
      await supabase
        .from("qualifying_result")
        .select("*, driver:drivers(*), constructor:constructors(*)")
        .eq("GrandPrixID", grandPrixId)
        .order("GridPosition"),
    );
    return data as unknown as (QualifyingResult & {
      driver: Driver;
      constructor: Constructor | null;
    })[];
  },

  async create(payload: Partial<QualifyingResult>) {
    return unwrap(
      await supabase
        .from("qualifying_result")
        .insert(payload as any)
        .select()
        .single(),
    );
  },

  async update(id: number, payload: Partial<QualifyingResult>) {
    return unwrap(
      await supabase
        .from("qualifying_result")
        .update(payload as any)
        .eq("QualifyingID", id)
        .select()
        .single(),
    );
  },

  async remove(id: number): Promise<void> {
    const { error } = await supabase
      .from("qualifying_result")
      .delete()
      .eq("QualifyingID", id);
    if (error) throw new Error(readableError(error));
  },
};

// =====================================================================
//  STATISZTIKÁK
//
//  A régi StatisticsController négy végpontját váltja ki. Az aggregáció
//  most adatbázis-oldalon fut (nézetek + RPC), így a sprint/futam
//  megkülönböztetés nem felejthető el — ez volt a Verstappen 13 vs 9
//  futamgyőzelem hiba oka.
// =====================================================================
export const statistics = {
  async driverStandings(): Promise<DriverStanding[]> {
    return unwrap(
      await supabase
        .from("v_driver_standings")
        .select("*")
        .order("points", { ascending: false })
        .order("wins", { ascending: false }),
    );
  },

  async constructorStandings(): Promise<ConstructorStanding[]> {
    return unwrap(
      await supabase
        .from("v_constructor_standings")
        .select("*")
        .order("points", { ascending: false })
        .order("wins", { ascending: false }),
    );
  },

  async driver(id: number): Promise<DriverStatsResult> {
    const { data, error } = await supabase.rpc("driver_stats", {
      p_driver_id: id,
    });
    if (error) throw new Error(readableError(error));
    return data as unknown as DriverStatsResult;
  },

  async constructor(id: number): Promise<ConstructorStatsResult> {
    const { data, error } = await supabase.rpc("constructor_stats", {
      p_constructor_id: id,
    });
    if (error) throw new Error(readableError(error));
    return data as unknown as ConstructorStatsResult;
  },
};

// =====================================================================
//  HÍREK – Supabase Edge Function
//
//  A régi /api/news Laravel-végpont helyett. Az Edge Function cache-eli
//  a választ, így nem minden főoldal-betöltés hívja a formula1.com-ot.
// =====================================================================
export interface NewsItem {
  title: string;
  link: string;
  pubDate: string;
  description: string;
}

export const news = {
  async latest(): Promise<NewsItem[]> {
    const { data, error } = await supabase.functions.invoke("news");
    if (error) throw new Error(readableError(error));
    return (data?.items ?? []) as NewsItem[];
  },
};

// =====================================================================
//  SEGÉDFÜGGVÉNYEK
// =====================================================================

/**
 * PostgreSQL INTERVAL ("00:01:16.627") -> "1:16.627"
 * A régi MySQL TIME oszlop ezt hibásan 1 óra 16 percként tárolta.
 */
export function formatLapTime(interval: string | null): string {
  if (!interval) return "—";
  const m = interval.match(/(\d+):(\d{2}):(\d{2})(\.\d+)?/);
  if (!m) return interval;
  const [, h, min, sec, frac] = m;
  const totalMinutes = Number(h) * 60 + Number(min);
  return `${totalMinutes}:${sec}${frac ? frac.padEnd(4, "0") : ".000"}`;
}

/** Csapatszínből CSS gradiens – kiváltja a hardkódolt constructorColors objektumot. */
export function teamGradient(colour: string | null): string {
  const c = colour ?? "#3a3a3a";
  return `linear-gradient(135deg, ${c} 0%, ${shade(c, -45)} 100%)`;
}

function shade(hex: string, amount: number): string {
  const n = parseInt(hex.replace("#", ""), 16);
  const clamp = (v: number) => Math.max(0, Math.min(255, v));
  const r = clamp((n >> 16) + amount);
  const g = clamp(((n >> 8) & 0xff) + amount);
  const b = clamp((n & 0xff) + amount);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

export const api = {
  drivers,
  constructors,
  circuits,
  grandPrix,
  raceResults,
  qualifying,
  statistics,
  news,
};

export default api;

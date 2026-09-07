// ---------------------------------------------------------------------
//  supabase/functions/sync-f1/providers.ts
//
//  Adatforrás-absztrakció (fejlesztesi_lehetosegek.md B6).
//
//  Miért kell: az OpenF1 csak 2023-tól ad adatot, a Jolpica 1950-ig
//  visszamenőleg. Ha később licencelt szolgáltatóra kell váltani
//  (lásd hosting_es_jogi_elemzes.md 4.3), az egy osztály cseréje lesz,
//  nem az egész szinkroné.
// ---------------------------------------------------------------------

/* =====================================================================
   RATE LIMITER

   Az OpenF1 free tier: 3 kérés / másodperc, 30 kérés / perc.
   Ezt NEM elég "úgy nagyjából" betartani — 429-et kapunk, és a szinkron
   félúton megáll. A limiter csúszóablakos, mindkét korlátot figyeli.
   ===================================================================== */
export class RateLimiter {
  private timestamps: number[] = [];

  constructor(
    private readonly perSecond = 3,
    private readonly perMinute = 30,
  ) {}

  private prune(now: number) {
    this.timestamps = this.timestamps.filter((t) => now - t < 60_000);
  }

  /** Megvárja, amíg szabad a következő kérés. */
  async acquire(): Promise<void> {
    for (;;) {
      const now = Date.now();
      this.prune(now);

      const lastSecond = this.timestamps.filter((t) => now - t < 1_000).length;
      const lastMinute = this.timestamps.length;

      if (lastSecond < this.perSecond && lastMinute < this.perMinute) {
        this.timestamps.push(now);
        return;
      }

      // Mennyit kell várni: a legkorábbi releváns kérés lejártáig
      const waitSecond =
        lastSecond >= this.perSecond
          ? 1_000 - (now - this.timestamps[this.timestamps.length - this.perSecond])
          : 0;
      const waitMinute =
        lastMinute >= this.perMinute ? 60_000 - (now - this.timestamps[0]) : 0;

      await sleep(Math.max(50, waitSecond, waitMinute));
    }
  }

  get requestCount(): number {
    return this.timestamps.length;
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/* =====================================================================
   KÖZÖS TÍPUSOK
   ===================================================================== */

export interface Meeting {
  meeting_key: number;
  meeting_name: string;
  meeting_official_name?: string;
  country_name: string;
  circuit_key: number;
  circuit_short_name: string;
  location: string;
  date_start: string;
  year: number;
}

export interface Session {
  session_key: number;
  meeting_key: number;
  session_name: string; // "Race" | "Qualifying" | "Sprint" | "Practice 1" ...
  session_type: string; // "Race" | "Qualifying" | "Practice"
  date_start: string;
  date_end: string;
  year: number;
}

export interface ProviderDriver {
  driver_number: number;
  full_name: string;
  name_acronym: string;
  team_name: string;
  team_colour: string | null; // hex, '#' NÉLKÜL jön az OpenF1-től
  country_code: string | null;
  session_key: number;
  meeting_key: number;
}

export interface SessionResult {
  position: number | null;
  driver_number: number;
  number_of_laps: number | null;
  /** Futamon összidő (mp), időmérőn [Q1, Q2, Q3] tömb */
  duration: number | number[] | null;
  gap_to_leader: number | string | (number | string | null)[] | null;
  dnf: boolean;
  dns: boolean;
  dsq: boolean;
  session_key: number;
  meeting_key: number;
}

export interface StartingGridRow {
  position: number;
  driver_number: number;
  lap_duration: number | null;
  session_key: number;
}

export interface Lap {
  driver_number: number;
  lap_number: number;
  lap_duration: number | null;
  duration_sector_1: number | null;
  duration_sector_2: number | null;
  duration_sector_3: number | null;
  st_speed: number | null;
  i1_speed: number | null;
  i2_speed: number | null;
  is_pit_out_lap: boolean;
  date_start: string | null;
  session_key: number;
}

export interface PitStop {
  driver_number: number;
  lap_number: number;
  pit_duration: number | null;
  date: string | null;
  session_key: number;
}

export interface Stint {
  driver_number: number;
  stint_number: number;
  compound: string | null;
  lap_start: number | null;
  lap_end: number | null;
  tyre_age_at_start: number | null;
  session_key: number;
}

export interface WeatherSample {
  date: string;
  air_temperature: number | null;
  track_temperature: number | null;
  humidity: number | null;
  pressure: number | null;
  wind_speed: number | null;
  wind_direction: number | null;
  rainfall: number | null;
  session_key: number;
}

/* =====================================================================
   ADATFORRÁS-INTERFÉSZ
   ===================================================================== */

export interface F1DataProvider {
  readonly name: string;
  readonly earliestSeason: number;
  meetings(year: number): Promise<Meeting[]>;
  sessions(meetingKey: number): Promise<Session[]>;
  drivers(sessionKey: number): Promise<ProviderDriver[]>;
  sessionResult(sessionKey: number): Promise<SessionResult[]>;
  startingGrid(sessionKey: number): Promise<StartingGridRow[]>;
  laps(sessionKey: number): Promise<Lap[]>;
  pitStops(sessionKey: number): Promise<PitStop[]>;
  stints(sessionKey: number): Promise<Stint[]>;
  weather(sessionKey: number): Promise<WeatherSample[]>;
  readonly requestCount: number;
}

/* =====================================================================
   OPENF1

   Historikus adat 2023-tól, hitelesítés nélkül. Az élő adat (session
   kezdete előtt 30 perctől a vége után 30 percig) előfizetéshez kötött.
   ===================================================================== */

export class OpenF1Provider implements F1DataProvider {
  readonly name = "openf1";
  readonly earliestSeason = 2023;

  private readonly base = "https://api.openf1.org/v1";
  private readonly limiter: RateLimiter;

  constructor(private readonly apiKey?: string) {
    // Támogatóknak duplázott limit; kulcs nélkül a szabad korlát érvényes.
    this.limiter = apiKey ? new RateLimiter(6, 60) : new RateLimiter(3, 30);
  }

  get requestCount() {
    return this.limiter.requestCount;
  }

  private async get<T>(path: string, params: Record<string, string | number> = {}): Promise<T[]> {
    const url = new URL(`${this.base}/${path}`);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));

    const headers: Record<string, string> = {
      Accept: "application/json",
      "User-Agent": "Gridline/1.0 (F1 statistics site)",
    };
    if (this.apiKey) headers.Authorization = `Bearer ${this.apiKey}`;

    // Három próbálkozás exponenciális visszalépéssel. A 429 és az 5xx
    // átmeneti; a 4xx többi tagja nem, azon nincs értelme újrapróbálni.
    let lastError = "";
    for (let attempt = 0; attempt < 3; attempt++) {
      await this.limiter.acquire();

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 20_000);
      try {
        const res = await fetch(url, { headers, signal: controller.signal });
        clearTimeout(timer);

        if (res.ok) return (await res.json()) as T[];

        if (res.status === 429 || res.status >= 500) {
          lastError = `${res.status} ${res.statusText}`;
          await sleep(2 ** attempt * 1_500);
          continue;
        }
        throw new Error(`OpenF1 ${path}: ${res.status} ${res.statusText}`);
      } catch (e) {
        clearTimeout(timer);
        lastError = e instanceof Error ? e.message : String(e);
        if (attempt === 2) throw new Error(`OpenF1 ${path}: ${lastError}`);
        await sleep(2 ** attempt * 1_500);
      }
    }
    throw new Error(`OpenF1 ${path}: ${lastError}`);
  }

  meetings(year: number) {
    return this.get<Meeting>("meetings", { year });
  }

  sessions(meetingKey: number) {
    return this.get<Session>("sessions", { meeting_key: meetingKey });
  }

  drivers(sessionKey: number) {
    return this.get<ProviderDriver>("drivers", { session_key: sessionKey });
  }

  sessionResult(sessionKey: number) {
    return this.get<SessionResult>("session_result", { session_key: sessionKey });
  }

  startingGrid(sessionKey: number) {
    return this.get<StartingGridRow>("starting_grid", { session_key: sessionKey });
  }

  laps(sessionKey: number) {
    return this.get<Lap>("laps", { session_key: sessionKey });
  }

  pitStops(sessionKey: number) {
    return this.get<PitStop>("pit", { session_key: sessionKey });
  }

  stints(sessionKey: number) {
    return this.get<Stint>("stints", { session_key: sessionKey });
  }

  weather(sessionKey: number) {
    return this.get<WeatherSample>("weather", { session_key: sessionKey });
  }
}

/* =====================================================================
   SEGÉDFÜGGVÉNYEK
   ===================================================================== */

/** Az OpenF1 '3671C6' formában adja a csapatszínt, a sémánk '#3671C6'-ot vár. */
export function normaliseColour(c: string | null | undefined): string | null {
  if (!c) return null;
  const hex = c.replace(/^#/, "").trim();
  return /^[0-9A-Fa-f]{6}$/.test(hex) ? `#${hex.toUpperCase()}` : null;
}

/** Másodperc -> PostgreSQL INTERVAL string. 76.732 -> '00:01:16.732' */
export function secondsToInterval(sec: number | null | undefined): string | null {
  if (sec == null || !isFinite(sec) || sec <= 0) return null;
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${s
    .toFixed(3)
    .padStart(6, "0")}`;
}

/**
 * Az időmérő `duration` mezője [Q1, Q2, Q3] tömb. A legjobb (legkisebb)
 * érvényes időt adja vissza, vagy a kért szegmenst.
 */
export function qualiTime(
  duration: number | number[] | null | undefined,
  segment?: 0 | 1 | 2,
): number | null {
  if (duration == null) return null;
  if (typeof duration === "number") return duration > 0 ? duration : null;
  if (segment != null) {
    const v = duration[segment];
    return typeof v === "number" && v > 0 ? v : null;
  }
  const valid = duration.filter((d) => typeof d === "number" && d > 0);
  return valid.length ? Math.min(...valid) : null;
}

/**
 * Kiesés oka a session_result mezőiből.
 * Az OpenF1 nem ad szöveges indoklást, csak a három logikai jelzőt.
 */
export function retirementReason(r: SessionResult): string | null {
  if (r.dsq) return "DSQ";
  if (r.dns) return "DNS";
  if (r.dnf) return "DNF";
  if (typeof r.gap_to_leader === "string") return r.gap_to_leader; // pl. "+1 LAP"
  if (typeof r.gap_to_leader === "number" && r.gap_to_leader > 0) {
    return `+${r.gap_to_leader.toFixed(3)}s`;
  }
  return null;
}
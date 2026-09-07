// ---------------------------------------------------------------------
//  supabase/functions/sync-f1/jolpica.ts
//
//  Történelmi adatok 1950-től. Az OpenF1 csak 2023-tól ad adatot.
//
//  A JOLPICA RATE LIMITJE HATÁROZZA MEG AZ EGÉSZ FELÉPÍTÉST:
//
//      Burst:     4 kérés / másodperc
//      Sustained: 500 kérés / ÓRA
//
//  A második a szűk keresztmetszet. Egy teljes 1950–2022 visszatöltés
//  nagyságrendileg:
//
//      73 szezon  ×  1 futamlista                    =    73 kérés
//      ~1 100 futam × 1 eredménylista                =  1 100 kérés
//      ~700 futam  × 1 időmérős lista (1994-től van) =    700 kérés
//      ------------------------------------------------------------
//                                                    ≈ 1 900 kérés
//
//  500/óra mellett ez KÖRÜLBELÜL NÉGY ÓRA. Egyetlen Edge Function
//  hívásba nem fér bele (a Supabase wall-clock limitje jóval rövidebb).
//
//  Ezért a szinkron SZEZONONKÉNT fut, és FOLYTATHATÓ: a sync_log tárolja,
//  melyik év készült el. Egy szezon ~35 kérés, ami bőven belefér egy
//  hívásba, és óránként ~14 szezon tölthető le.
// ---------------------------------------------------------------------

import type {
  F1DataProvider,
  Meeting,
  Session,
  ProviderDriver,
  SessionResult,
  StartingGridRow,
  Lap,
  PitStop,
  Stint,
  WeatherSample,
} from "./providers.ts";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/* =====================================================================
   KÉTSZINTŰ RATE LIMITER

   A providers.ts-ben lévő RateLimiter másodperc/perc párost kezel.
   A Jolpicánál óra a második dimenzió, ezért külön osztály kell:
   egy 60 másodperces és egy 3600 másodperces csúszóablak.
   ===================================================================== */
export class DualRateLimiter {
  private times: number[] = [];

  constructor(
    private readonly perSecond = 4,
    private readonly perHour = 500,
  ) {}

  async acquire(): Promise<void> {
    for (;;) {
      const now = Date.now();
      this.times = this.times.filter((t) => now - t < 3_600_000);

      const lastSecond = this.times.filter((t) => now - t < 1_000).length;
      const lastHour = this.times.length;

      if (lastSecond < this.perSecond && lastHour < this.perHour) {
        this.times.push(now);
        return;
      }

      // Meddig kell várni? A szűkebb korlát dönt.
      const waitSecond =
        lastSecond >= this.perSecond
          ? 1_000 - (now - this.times[this.times.length - this.perSecond])
          : 0;
      const waitHour =
        lastHour >= this.perHour ? 3_600_000 - (now - this.times[0]) : 0;

      const wait = Math.max(100, waitSecond, waitHour);

      // Ha órás limitbe futottunk, nincs értelme várni egy Edge Functionben.
      if (wait > 60_000) {
        throw new Error(
          `Jolpica órás limit elérve (${this.perHour}/óra). ` +
            `A következő kérés ${Math.round(wait / 60_000)} perc múlva lehetséges. ` +
            `Folytasd később a következő szezonnal.`,
        );
      }
      await sleep(wait);
    }
  }

  get requestCount(): number {
    return this.times.length;
  }
}

/* =====================================================================
   ERGAST/JOLPICA VÁLASZTÍPUSOK
   ===================================================================== */

interface ErgastLocation {
  lat: string;
  long: string;
  locality: string;
  country: string;
}

interface ErgastCircuit {
  circuitId: string;
  url?: string;
  circuitName: string;
  Location: ErgastLocation;
}

export interface ErgastDriver {
  driverId: string;
  permanentNumber?: string;
  code?: string;
  url?: string;
  givenName: string;
  familyName: string;
  dateOfBirth: string;
  nationality: string;
}

export interface ErgastConstructor {
  constructorId: string;
  url?: string;
  name: string;
  nationality: string;
}

export interface ErgastResult {
  number?: string;
  position: string;
  /** "1".."26" vagy R (retired), D (disqualified), E (excluded), W, F, N */
  positionText: string;
  points: string;
  Driver: ErgastDriver;
  Constructor: ErgastConstructor;
  grid: string;
  laps: string;
  status: string;
  Time?: { millis?: string; time?: string };
  FastestLap?: { rank?: string; lap?: string; Time?: { time?: string } };
}

export interface ErgastQualifying {
  number?: string;
  position: string;
  Driver: ErgastDriver;
  Constructor: ErgastConstructor;
  Q1?: string;
  Q2?: string;
  Q3?: string;
}

export interface ErgastRace {
  season: string;
  round: string;
  url?: string;
  raceName: string;
  Circuit: ErgastCircuit;
  date: string;
  time?: string;
  Results?: ErgastResult[];
  QualifyingResults?: ErgastQualifying[];
  SprintResults?: ErgastResult[];
}

interface ErgastResponse {
  MRData: {
    limit: string;
    offset: string;
    total: string;
    RaceTable?: { season?: string; Races: ErgastRace[] };
  };
}

/* =====================================================================
   PROVIDER
   ===================================================================== */

export class JolpicaProvider {
  readonly name = "jolpica";
  readonly earliestSeason = 1950;

  private readonly base = "https://api.jolpi.ca/ergast/f1";
  private readonly limiter: DualRateLimiter;

  constructor(private readonly apiToken?: string) {
    // Tokennel magasabb limit kérhető a fejlesztőktől; e nélkül a szabad korlát.
    this.limiter = new DualRateLimiter(4, apiToken ? 5000 : 500);
  }

  get requestCount() {
    return this.limiter.requestCount;
  }

  /**
   * Egy végpont teljes lekérése, lapozással.
   * A Jolpica limitje oldalanként legfeljebb 100.
   */
  private async getAll(path: string): Promise<ErgastRace[]> {
    const races: ErgastRace[] = [];
    let offset = 0;
    const limit = 100;

    for (;;) {
      const url = `${this.base}/${path}.json?limit=${limit}&offset=${offset}`;
      const data = await this.fetchJson(url);

      const batch = data.MRData.RaceTable?.Races ?? [];
      races.push(...batch);

      const total = parseInt(data.MRData.total, 10);
      offset += limit;
      if (offset >= total || batch.length === 0) break;
    }
    return races;
  }

  private async fetchJson(url: string): Promise<ErgastResponse> {
    const headers: Record<string, string> = {
      Accept: "application/json",
      "User-Agent": "Gridline/1.0 (F1 statistics site)",
    };
    if (this.apiToken) headers.Authorization = `Bearer ${this.apiToken}`;

    let lastError = "";
    for (let attempt = 0; attempt < 3; attempt++) {
      await this.limiter.acquire();

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 25_000);
      try {
        const res = await fetch(url, { headers, signal: controller.signal });
        clearTimeout(timer);

        if (res.ok) return (await res.json()) as ErgastResponse;

        if (res.status === 429) {
          // A Retry-After fejlécet tiszteletben tartjuk, ha van
          const retry = parseInt(res.headers.get("Retry-After") ?? "0", 10);
          if (retry > 60) {
            throw new Error(
              `Jolpica 429: ${retry} mp várakozás szükséges. Folytasd később.`,
            );
          }
          lastError = "429 Too Many Requests";
          await sleep(Math.max(2_000, retry * 1_000) * (attempt + 1));
          continue;
        }

        if (res.status >= 500) {
          lastError = `${res.status} ${res.statusText}`;
          await sleep(2 ** attempt * 1_500);
          continue;
        }
        throw new Error(`Jolpica ${url}: ${res.status} ${res.statusText}`);
      } catch (e) {
        clearTimeout(timer);
        lastError = e instanceof Error ? e.message : String(e);
        if (lastError.includes("Folytasd később")) throw e;
        if (attempt === 2) throw new Error(`Jolpica ${url}: ${lastError}`);
        await sleep(2 ** attempt * 1_500);
      }
    }
    throw new Error(`Jolpica ${url}: ${lastError}`);
  }

  /* --- Publikus lekérdezések ---------------------------------------- */

  /** Egy szezon futamnaptára, eredmények nélkül. 1 kérés. */
  season(year: number): Promise<ErgastRace[]> {
    return this.getAll(`${year}/races`);
  }

  /** Egy szezon ÖSSZES futameredménye. Lapozással ~5-10 kérés. */
  seasonResults(year: number): Promise<ErgastRace[]> {
    return this.getAll(`${year}/results`);
  }

  /** Időmérős eredmények. Az Ergast csak 1994-től tartalmazza. */
  seasonQualifying(year: number): Promise<ErgastRace[]> {
    return this.getAll(`${year}/qualifying`);
  }

  /** Sprintek. Csak 2021-től. */
  seasonSprint(year: number): Promise<ErgastRace[]> {
    return this.getAll(`${year}/sprint`);
  }
}

/* =====================================================================
   LEKÉPEZÉS A SAJÁT SÉMÁRA
   ===================================================================== */

/**
 * Az Ergast `status` mezője szabad szöveg ("Engine", "+1 Lap",
 * "Collision damage"). A 04_historikus_migracio.sql race_statuses
 * taxonómiájára képezzük le, hogy lekérdezhető legyen.
 */
export function mapStatus(status: string, positionText: string): number {
  const s = status.toLowerCase();

  // A positionText az elsődleges jelzés
  if (positionText === "D") return 16; // disqualified
  if (positionText === "W") return 19; // withdrew
  if (positionText === "F") return 18; // did not qualify
  if (positionText === "E") return 17; // excluded / did not start
  if (positionText === "N") return 21; // not classified

  if (s === "finished") return 1;
  if (/^\+\d+ lap/.test(s)) return 2; // "+1 Lap", "+2 Laps"

  const map: [RegExp, number][] = [
    [/engine|blown|piston|valve|cylinder/, 3],
    [/gearbox|clutch|differential/, 4],
    [/hydraulic/, 5],
    [/electr|battery|alternator|ignition|electronics/, 6],
    [/suspension|wheel|steering|driveshaft/, 7],
    [/brake/, 8],
    [/transmission|halfshaft|drivetrain/, 9],
    [/tyre|puncture|tire/, 10],
    [/fuel|refuel/, 11],
    [/overheating|radiator|water|cooling/, 12],
    [/accident|crash/, 13],
    [/collision|damage/, 14],
    [/spun off|spin/, 15],
    [/did not start|withdrew|not started/, 17],
    [/did not qualify|did not prequalify/, 18],
    [/retired|mechanical|out of|illness|injur|fatal/, 20],
    [/not classified/, 21],
  ];
  for (const [re, id] of map) if (re.test(s)) return id;
  return 99; // unknown
}

/** Az Ergast positionText alapján befejezte-e a versenyt. */
export function isClassified(positionText: string): boolean {
  return /^\d+$/.test(positionText);
}

/** "1:23.456" -> PostgreSQL INTERVAL "00:01:23.456" */
export function qualiTimeToInterval(t: string | undefined): string | null {
  if (!t) return null;
  const m = t.match(/^(?:(\d+):)?(\d+):([\d.]+)$/);
  if (!m) return null;
  const [, h, min, sec] = m;
  const hh = h ?? "0";
  return `${hh.padStart(2, "0")}:${min.padStart(2, "0")}:${sec.padStart(6, "0")}`;
}

/** Ergast nemzetiség ("Dutch") -> ISO-3 országkód. Bővíthető. */
const NATIONALITY_TO_CODE: Record<string, string> = {
  British: "GBR", German: "DEU", Italian: "ITA", French: "FRA",
  Brazilian: "BRA", Dutch: "NLD", Spanish: "ESP", Finnish: "FIN",
  Austrian: "AUT", Australian: "AUS", Argentine: "ARG", American: "USA",
  Belgian: "BEL", Swiss: "CHE", Swedish: "SWE", Mexican: "MEX",
  Canadian: "CAN", Japanese: "JPN", Monegasque: "MCO", Danish: "DNK",
  Thai: "THA", Polish: "POL", Russian: "RUS", "New Zealander": "NZL",
  Colombian: "COL", Venezuelan: "VEN", Portuguese: "PRT", Irish: "IRL",
  Hungarian: "HUN", Czech: "CZE", Chinese: "CHN", Indian: "IND",
  Malaysian: "MYS", Indonesian: "IDN", "South African": "ZAF",
  Rhodesian: "ZWE", Uruguayan: "URY", Chilean: "CHL", Liechtensteiner: "LIE",
  "East German": "DEU", Zimbabwean: "ZWE",
};

export function nationalityToCode(n: string | undefined): string | null {
  if (!n) return null;
  return NATIONALITY_TO_CODE[n] ?? null;
}

/** "Max" + "Verstappen" -> "Max Verstappen" */
export function driverFullName(d: ErgastDriver): string {
  return `${d.givenName} ${d.familyName}`.trim();
}
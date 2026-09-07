// ---------------------------------------------------------------------
//  src/lib/database.types.ts
//
//  A 02_schema_postgres_supabase.sql sémának megfelelő típusok.
//
//  Ezt a fájlt később generálni is lehet, így a séma és a TypeScript
//  soha nem csúszik szét:
//     npx supabase gen types typescript --project-id <ref> > src/lib/database.types.ts
// ---------------------------------------------------------------------

export type Circuit = {
  CircuitID: number;
  Name: string;
  Location: string | null;
  Country: string | null;
  Length: number | null;
  Laps: number | null;
  FirstGrandPrix: number | null;
  RecordDriver: string | null;
  /** PostgreSQL INTERVAL, JSON-ban stringként: "00:01:16.627" */
  RecordLapTime: string | null;
  Image: string;
  image_author: string | null;
  image_license: string | null;
  image_source_url: string | null;
  created_at: string;
  updated_at: string;
}

export type Constructor = {
  ConstructorID: number;
  Name: string;
  Nationality: string | null;
  FoundedYear: number | null;
  TeamPrincipal: string | null;
  Wins: number;
  PolePositions: number;
  Podiums: number;
  WorldChampionships: number;
  History: string | null;
  Image: string;
  /** #RRGGBB – a frontend gradiensei ebből épülnek */
  TeamColour: string | null;
  image_author: string | null;
  image_license: string | null;
  image_source_url: string | null;
  created_at: string;
  updated_at: string;
}

export type Driver = {
  DriverID: number;
  Name: string;
  ConstructorID: number | null;
  Nationality: string | null;
  BirthDate: string | null;
  Biography: string | null;
  Image: string;
  DriverNumber: number | null;
  Acronym: string | null;
  image_author: string | null;
  image_license: string | null;
  image_source_url: string | null;
  created_at: string;
  updated_at: string;
}

export type GrandPrix = {
  GrandPrixID: number;
  Name: string;
  Country: string | null;
  CircuitID: number | null;
  Year: number;
  WinnerDriverID: number | null;
  Image: string;
  Round: number | null;
  RaceDate: string | null;
  created_at: string;
  updated_at: string;
}

export type RaceResult = {
  ResultID: number;
  GrandPrixID: number;
  DriverID: number;
  ConstructorID: number;
  Position: number | null;
  Grid: number | null;
  Laps: number | null;
  TimeOrRetired: string | null;
  /** A trg_assign_points trigger számolja – írni felesleges */
  Points: number;
  FastestLap: boolean;
  /** true = Grand Prix, false = sprint */
  GpOrSprint: boolean;
  created_at: string;
  updated_at: string;
}

export type QualifyingResult = {
  QualifyingID: number;
  GrandPrixID: number;
  DriverID: number;
  ConstructorID: number | null;
  GridPosition: number | null;
  Q1Time: string | null;
  Q2Time: string | null;
  Q3Time: string | null;
  created_at: string;
  updated_at: string;
}

export type TeamDriver = {
  id: number;
  ConstructorID: number;
  DriverID: number;
  FirstYear: number;
  EndYear: number | null;
  created_at: string;
  updated_at: string;
}

export type Profile = {
  id: string;
  email: string | null;
  role: "user" | "admin";
  created_at: string;
  updated_at: string;
}

// --- Nézetek --------------------------------------------------------

export type DriverStanding = {
  DriverID: number;
  driver_name: string;
  Nationality: string | null;
  DriverNumber: number | null;
  Acronym: string | null;
  Image: string;
  ConstructorID: number | null;
  constructor_name: string | null;
  team_colour: string | null;
  points: number;
  wins: number;
  podiums: number;
  fastest_laps: number;
  races: number;
  dnfs: number;
}

export type ConstructorStanding = {
  ConstructorID: number;
  constructor_name: string;
  Nationality: string | null;
  Image: string;
  team_colour: string | null;
  points: number;
  wins: number;
  podiums: number;
  fastest_laps: number;
  races: number;
}

export type RacePoints = {
  DriverID?: number;
  GrandPrixID: number;
  grand_prix_name: string;
  Country: string | null;
  Year: number;
  Round: number | null;
  points: number;
}

// --- RPC visszatérési típusok ---------------------------------------

export type DriverStatsResult = {
  driver: DriverStanding | null;
  points_chart: RacePoints[];
}

export type ConstructorStatsResult = {
  constructor: ConstructorStanding | null;
  drivers: DriverStanding[];
  points_chart: RacePoints[];
}

// --- Insert / Update segédtípusok -----------------------------------
// A generált oszlopokat (ID, időbélyegek, trigger által számolt Points)
// kihagyjuk, hogy a TypeScript figyelmeztessen, ha véletlenül írni akarnád.

type Generated = "created_at" | "updated_at";

export type CircuitInsert = Omit<Circuit, "CircuitID" | Generated> &
  Partial<Pick<Circuit, "CircuitID">>;
export type ConstructorInsert = Omit<Constructor, "ConstructorID" | Generated> &
  Partial<Pick<Constructor, "ConstructorID">>;
export type DriverInsert = Omit<Driver, "DriverID" | Generated> &
  Partial<Pick<Driver, "DriverID">>;
export type GrandPrixInsert = Omit<
  GrandPrix,
  "GrandPrixID" | "WinnerDriverID" | Generated
> &
  Partial<Pick<GrandPrix, "GrandPrixID">>;
export type RaceResultInsert = Omit<
  RaceResult,
  "ResultID" | "Points" | Generated
> &
  Partial<Pick<RaceResult, "ResultID">>;
export type QualifyingResultInsert = Omit<
  QualifyingResult,
  "QualifyingID" | Generated
> &
  Partial<Pick<QualifyingResult, "QualifyingID">>;

// --- A supabase-js generikus paramétere ------------------------------
//
//  FONTOS: minden típus `type` alias, NEM `interface`.
//  A supabase-js a Row/Insert/Update típusokat a Record<string, unknown>
//  megszorítás alá helyezi, és a TypeScript interface-ei — a type aliasokkal
//  ellentétben — nem kapnak implicit indexszignatúrát, ezért nem felelnek meg
//  neki. Interface-szel minden .insert()/.update()/.rpc() hívás `never`
//  paramétertípust kapna, és nem fordulna le.

// ---------------------------------------------------------------------
//
//
//   1. Az alábbi `export type` blokkokat illeszd be a database.types.ts
//
// ---------------------------------------------------------------------

// =====================================================================
// =====================================================================

export type Lap = {
  id: number;
  GrandPrixID: number;
  DriverID: number;
  session_key: number;
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
  created_at: string;
};

export type PitStop = {
  id: number;
  GrandPrixID: number;
  DriverID: number;
  session_key: number;
  lap_number: number;
  pit_duration: number | null;
  date: string | null;
  created_at: string;
};

export type Stint = {
  id: number;
  GrandPrixID: number;
  DriverID: number;
  session_key: number;
  stint_number: number;
  compound: string | null;
  lap_start: number | null;
  lap_end: number | null;
  tyre_age_at_start: number | null;
  created_at: string;
};

export type Weather = {
  id: number;
  GrandPrixID: number;
  session_key: number;
  date: string;
  air_temperature: number | null;
  track_temperature: number | null;
  humidity: number | null;
  pressure: number | null;
  wind_speed: number | null;
  wind_direction: number | null;
  rainfall: number | null;
};

export type SyncLog = {
  id: number;
  provider: string;
  task: string;
  season: number | null;
  session_key: number | null;
  status: "running" | "ok" | "partial" | "error" | "skipped";
  rows_upserted: number;
  requests_made: number;
  message: string | null;
  started_at: string;
  finished_at: string | null;
};

// =====================================================================
// =====================================================================

export type Season = {
  year: number;
  counted_results: number | null;
  counted_results_2: number | null;
  split_round: number | null;
  fastest_lap_point: number;
  fastest_lap_max_pos: number | null;
  shared_drives: boolean;
  sprint_format: boolean;
  qualifying_format: string | null;
  note: string | null;
  created_at: string;
  updated_at: string;
};

export type SeasonPoints = {
  year: number;
  is_race: boolean;
  position: number;
  points: number;
};

export type SeasonEntry = {
  id: number;
  DriverID: number;
  ConstructorID: number;
  year: number;
  car_number: number | null;
  from_round: number | null;
  to_round: number | null;
  is_test_driver: boolean;
  created_at: string;
};

export type EngineManufacturer = {
  id: number;
  name: string;
  country_code: string | null;
  created_at: string;
};

export type ConstructorEngine = {
  id: number;
  ConstructorID: number;
  engine_id: number;
  year: number;
  engine_name: string | null;
  created_at: string;
};

export type RaceStatus = {
  id: number;
  code: string;
  label_hu: string;
  category: "finished" | "mechanical" | "accident" | "disqualified" | "other";
  is_classified: boolean;
};

export type SchemaVersion = {
  version: string;
  applied_at: string;
  note: string | null;
};

// =====================================================================
// =====================================================================

export type RaceStrategy = {
  GrandPrixID: number;
  DriverID: number;
  driver_name: string;
  Acronym: string | null;
  team_colour: string | null;
  stint_number: number;
  compound: string | null;
  lap_start: number | null;
  lap_end: number | null;
  tyre_age_at_start: number | null;
  stint_length: number | null;
};

export type ChampionshipProgress = {
  Year: number;
  Round: number | null;
  GrandPrixID: number;
  DriverID: number;
  driver_name: string;
  cumulative_points: number;
};

export type DriverCareer = {
  DriverID: number;
  driver_name: string;
  Nationality: string | null;
  country_code: string | null;
  first_season: number | null;
  last_season: number | null;
  seasons: number;
  starts: number;
  wins: number;
  podiums: number;
  fastest_laps: number;
  poles: number;
  retirements: number;
  career_points: number;
};

export type RetirementStat = {
  decade: number;
  category: string;
  label_hu: string;
  occurrences: number;
};

/** A season_driver_standings(year) RPC visszatérési sora. */
export type SeasonStanding = {
  DriverID: number;
  driver_name: string;
  constructor_name: string | null;
  gross_points: number;
  counted_points: number;
  dropped_points: number;
  wins: number;
  podiums: number;
  races: number;
};



export type Database = {
  public: {
    Tables: {
      circuits: { Row: Circuit; Insert: CircuitInsert; Update: Partial<CircuitInsert>; Relationships: [] };
      constructors: { Row: Constructor; Insert: ConstructorInsert; Update: Partial<ConstructorInsert>; Relationships: [] };
      drivers: { Row: Driver; Insert: DriverInsert; Update: Partial<DriverInsert>; Relationships: [] };
      grandprix: { Row: GrandPrix; Insert: GrandPrixInsert; Update: Partial<GrandPrixInsert>; Relationships: [] };
      race_result: { Row: RaceResult; Insert: RaceResultInsert; Update: Partial<RaceResultInsert>; Relationships: [] };
      qualifying_result: { Row: QualifyingResult; Insert: QualifyingResultInsert; Update: Partial<QualifyingResultInsert>; Relationships: [] };
      teams_drivers: { Row: TeamDriver; Insert: Omit<TeamDriver, "id" | Generated>; Update: Partial<Omit<TeamDriver, "id" | Generated>>; Relationships: [] };
      profiles: { Row: Profile; Insert: Profile; Update: Partial<Profile>; Relationships: [] };
      laps: { Row: Lap; Insert: Omit<Lap,"id"|"created_at">; Update: Partial<Lap>; Relationships: [] };
      pit_stops: { Row: PitStop; Insert: Omit<PitStop,"id"|"created_at">; Update: Partial<PitStop>; Relationships: [] };
      stints: { Row: Stint; Insert: Omit<Stint,"id"|"created_at">; Update: Partial<Stint>; Relationships: [] };
      weather: { Row: Weather; Insert: Omit<Weather,"id">; Update: Partial<Weather>; Relationships: [] };
      sync_log: { Row: SyncLog; Insert: Partial<SyncLog>; Update: Partial<SyncLog>; Relationships: [] };
      seasons: { Row: Season; Insert: Partial<Season> & { year: number }; Update: Partial<Season>; Relationships: [] };
      season_points: { Row: SeasonPoints; Insert: SeasonPoints; Update: Partial<SeasonPoints>; Relationships: [] };
      season_entries: { Row: SeasonEntry; Insert: Omit<SeasonEntry,"id"|"created_at">; Update: Partial<SeasonEntry>; Relationships: [] };
      engine_manufacturers: { Row: EngineManufacturer; Insert: Omit<EngineManufacturer,"id"|"created_at">; Update: Partial<EngineManufacturer>; Relationships: [] };
      constructor_engines: { Row: ConstructorEngine; Insert: Omit<ConstructorEngine,"id"|"created_at">; Update: Partial<ConstructorEngine>; Relationships: [] };
      race_statuses: { Row: RaceStatus; Insert: RaceStatus; Update: Partial<RaceStatus>; Relationships: [] };
      schema_version: { Row: SchemaVersion; Insert: SchemaVersion; Update: Partial<SchemaVersion>; Relationships: [] };
    };
    Views: {
      v_driver_standings: { Row: DriverStanding; Relationships: [] };
      v_constructor_standings: { Row: ConstructorStanding; Relationships: [] };
      v_driver_race_points: { Row: RacePoints; Relationships: [] };
      v_race_strategy: { Row: RaceStrategy; Relationships: [] };
      v_championship_progress: { Row: ChampionshipProgress; Relationships: [] };
      v_driver_career: { Row: DriverCareer; Relationships: [] };
      v_retirement_stats: { Row: RetirementStat; Relationships: [] };
    };
    Functions: {
      driver_stats: { Args: { p_driver_id: number }; Returns: DriverStatsResult };
      constructor_stats: { Args: { p_constructor_id: number }; Returns: ConstructorStatsResult };
      is_admin: { Args: Record<string, never>; Returns: boolean };
      season_driver_standings: { Args: { p_year: number }; Returns: SeasonStanding[] };
      last_successful_sync: { Args: { p_task: string }; Returns: string | null };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
}
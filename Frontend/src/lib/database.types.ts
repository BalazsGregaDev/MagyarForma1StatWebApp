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
    };
    Views: {
      v_driver_standings: { Row: DriverStanding; Relationships: [] };
      v_constructor_standings: { Row: ConstructorStanding; Relationships: [] };
      v_driver_race_points: { Row: RacePoints; Relationships: [] };
    };
    Functions: {
      driver_stats: { Args: { p_driver_id: number }; Returns: DriverStatsResult };
      constructor_stats: { Args: { p_constructor_id: number }; Returns: ConstructorStatsResult };
      is_admin: { Args: Record<string, never>; Returns: boolean };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
}
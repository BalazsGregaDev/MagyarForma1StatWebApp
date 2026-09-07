// ---------------------------------------------------------------------
//  src/lib/supabase.ts
//  Egyetlen, alkalmazás-szintű Supabase kliens.
//
//  A korábbi kódban 12+ fájlban volt bedrótozva a Railway API címe.
//  Mostantól minden hívás ezen a kliensen megy keresztül.
// ---------------------------------------------------------------------
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;


// Mindkét változónév elfogadott. A Supabase 2026 végével megszünteti a régi
// JWT-alapú anon kulcsot; az új, sb_publishable_ előtagú kulcs a helyes érték.
const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
  import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  const hiba = [
    !supabaseUrl && "VITE_SUPABASE_URL",
    !supabaseAnonKey && "VITE_SUPABASE_PUBLISHABLE_KEY",
  ]
    .filter(Boolean)
    .join(" és ");

  throw new Error(
    `Hiányzó Supabase konfiguráció: ${hiba}. ` +
      "Lokálisan: Frontend/.env.local, majd a dev szerver ÚJRAINDÍTÁSA " +
      "(a Vite csak induláskor olvassa a .env fájlokat). " +
      "Vercelen: Settings -> Environment Variables, majd Redeploy.",
  );
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    // A session a localStorage-ban marad, és a lejáró tokent a kliens
    // automatikusan frissíti — nem kell kézzel kezelni, mint a Sanctum
    // CSRF-cookie-jánál.
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

/**
 * A PostgREST hibáit olvasható magyar üzenetté alakítja.
 * A `code` mezők PostgreSQL SQLSTATE értékek.
 */
export function readableError(error: unknown): string {
  if (!error) return "Ismeretlen hiba.";
  const e = error as { code?: string; message?: string; details?: string };

  switch (e.code) {
    case "23505":
      return "Ez a rekord már létezik (egyedi mező ütközés).";
    case "23503":
      return "A művelet másik rekordra hivatkozik, amely nem létezik, vagy amelyre még hivatkoznak.";
    case "23514":
      // CHECK megszorítás vagy RAISE EXCEPTION a triggerből
      return e.message ?? "Az adat nem felel meg egy adatbázis-szabálynak.";
    case "42501":
      return "Nincs jogosultságod ehhez a művelethez. Jelentkezz be adminisztrátorként.";
    case "PGRST301":
      return "A munkameneted lejárt. Jelentkezz be újra.";
    default:
      return e.message || e.details || "A művelet nem sikerült.";
  }
}

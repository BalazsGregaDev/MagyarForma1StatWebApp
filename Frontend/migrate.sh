#!/usr/bin/env bash
#
#  migrate.sh — CRA -> Vite + mappaátrendezés
#
#  Futtatás a Frontend/ mappából:
#      bash migrate.sh
#
#  A fájlmozgatásokat `git mv`-vel végzi, hogy a Git kövesse az átnevezéseket.
#  A kis-nagybetűs átnevezéseket (navbar.tsx -> Navbar.tsx) KÉT LÉPÉSBEN,
#  mert Windows és macOS alatt a fájlrendszer nem különbözteti meg őket,
#  és az egylépéses `git mv navbar.tsx Navbar.tsx` hibára fut.
#
set -euo pipefail

cd "$(dirname "$0")"
S=src

# git nélkül is működjön (pl. próbafuttatás)
if git rev-parse --git-dir >/dev/null 2>&1; then
  MV="git -C . mv"
else
  MV="mv"
fi
# Kis-nagybetűs átnevezés két lépésben
rename_ci() {
  $MV "$1" "$1.tmp"
  $MV "$1.tmp" "$2"
}

echo "==> Mappák létrehozása"
mkdir -p "$S/components/admin"

echo "==> lib/ tartalma a src gyökérbe"
$MV "$S/lib/supabase.ts"        "$S/supabaseClient.ts"
$MV "$S/lib/api.ts"             "$S/api.ts"
$MV "$S/lib/database.types.ts"  "$S/database.types.ts"
$MV "$S/lib/AuthContext.tsx"    "$S/AuthContext.tsx"
rmdir "$S/lib"

echo "==> Belépési pont"
$MV "$S/index.tsx" "$S/main.tsx"
rm -f "$S/react-app-env.d.ts"

echo "==> Komponensek átnevezése"
rename_ci "$S/components/navbar.tsx"      "$S/components/Navbar.tsx"
if [ -f "$S/components/themeContext.tsx" ]; then
  rename_ci "$S/components/themeContext.tsx" "$S/components/ThemeContext.tsx"
elif [ ! -f "$S/components/ThemeContext.tsx" ]; then
  echo "FIGYELEM: themeContext.tsx nem található — ellenőrizd kézzel!" >&2
fi

echo "==> pages/ -> components/"
$MV "$S/pages/home.tsx"         "$S/components/Home.tsx"
$MV "$S/pages/driver.tsx"       "$S/components/Drivers.tsx"
$MV "$S/pages/constructors.tsx" "$S/components/Constructors.tsx"
$MV "$S/pages/circuit.tsx"      "$S/components/Circuits.tsx"
$MV "$S/pages/grand_prix.tsx"   "$S/components/GrandPrix.tsx"
$MV "$S/pages/statistics.tsx"   "$S/components/Statistics.tsx"
$MV "$S/pages/login.tsx"        "$S/components/Login.tsx"

echo "==> pages/detailPages/ -> components/"
$MV "$S/pages/detailPages/driverDetail.tsx"      "$S/components/DriverDetail.tsx"
$MV "$S/pages/detailPages/constructorDetail.tsx" "$S/components/ConstructorDetail.tsx"
$MV "$S/pages/detailPages/circuitDetail.tsx"     "$S/components/CircuitDetail.tsx"
$MV "$S/pages/detailPages/grandPrixDetail.tsx"   "$S/components/GrandPrixDetail.tsx"
rmdir "$S/pages/detailPages" "$S/pages"

echo "==> adminPages/ -> components/admin/"
$MV "$S/adminPages/AdminCrud.tsx"             "$S/components/admin/AdminCrud.tsx"
$MV "$S/adminPages/adminDriverPage.tsx"       "$S/components/admin/AdminDrivers.tsx"
$MV "$S/adminPages/adminConstructorPage.tsx"  "$S/components/admin/AdminConstructors.tsx"
$MV "$S/adminPages/adminCircuitPage.tsx"      "$S/components/admin/AdminCircuits.tsx"
$MV "$S/adminPages/adminGrandPrixPage.tsx"    "$S/components/admin/AdminGrandPrix.tsx"
$MV "$S/adminPages/adminStatistics.tsx"       "$S/components/admin/AdminResults.tsx"
rmdir "$S/adminPages"

echo "==> styles/ -> Styles/"
rename_ci "$S/styles" "$S/Styles"

echo "==> index.html a gyökérbe"
[ -f public/index.html ] && $MV public/index.html index.html || true

# =====================================================================
#  IMPORT-ÚTVONALAK ÁTÍRÁSA
# =====================================================================
echo "==> Importok átírása"

TS=$(find "$S" -name '*.ts' -o -name '*.tsx')

# --- 1. lib/ hivatkozások megszűnnek -------------------------------
#   src gyökér:            ./lib/x   -> ./x
#   components/:           ../lib/x  -> ../x
#   components/admin/:     ../lib/x  -> ../../x   (a mélységet lentebb kezeljük)
#   detailPages volt:      ../../lib/x -> ../x
sed -i -E 's#(["'"'"'])\.\./\.\./lib/#\1../#g'  $TS
sed -i -E 's#(["'"'"'])\.\./lib/#\1../#g'       $TS
sed -i -E 's#(["'"'"'])\./lib/#\1./#g'          $TS

# --- 2. styles -> Styles, és a mélység normalizálása ----------------
sed -i -E 's#\.\./\.\./styles/#../Styles/#g' $TS
sed -i -E 's#\.\./styles/#../Styles/#g'      $TS
sed -i -E 's#\./styles/#./Styles/#g'         $TS

# --- 3. A volt detailPages fájlok egy szinttel feljebb kerültek -----
for f in DriverDetail ConstructorDetail CircuitDetail GrandPrixDetail; do
  sed -i -E 's#(["'"'"'])\.\./\.\./#\1../#g' "$S/components/$f.tsx"
done

# --- 4. Az admin fájlok egy szinttel LEJJEBB kerültek ---------------
for f in "$S"/components/admin/*.tsx; do
  # ../api -> ../../api  (és a többi src-gyökér modul)
  sed -i -E 's#(["'"'"'])\.\./(api|supabaseClient|database\.types|AuthContext|config)(["'"'"'])#\1../../\2\3#g' "$f"
  # ../Styles/ -> ../../Styles/
  sed -i -E 's#(["'"'"'])\.\./Styles/#\1../../Styles/#g' "$f"
  # ../components/X -> ../X   (AdminCrud korábban ../components-re hivatkozott)
  sed -i -E 's#(["'"'"'])\.\./components/#\1../#g' "$f"
done

# --- 5. Régi fájlnevek -> újak minden importban ---------------------
#  FONTOS: a supabase -> supabaseClient átnevezés a lib/ levágása UTÁN fut,
#  ezért a path itt már ./supabase vagy ../supabase alakú.
sed -i -E 's#(["'"'"'])(\.{1,2}/(\.\./)*)supabase(["'"'"'])#\1\2supabaseClient\4#g' $TS

sed -i -E \
  -e 's#components/navbar(["'"'"'])#components/Navbar\1#g' \
  -e 's#components/themeContext(["'"'"'])#components/ThemeContext\1#g' \
  -e 's#\./navbar(["'"'"'])#./Navbar\1#g' \
  -e 's#\./themeContext(["'"'"'])#./ThemeContext\1#g' \
  -e 's#pages/detailPages/driverDetail(["'"'"'])#components/DriverDetail\1#g' \
  -e 's#pages/detailPages/constructorDetail(["'"'"'])#components/ConstructorDetail\1#g' \
  -e 's#pages/detailPages/circuitDetail(["'"'"'])#components/CircuitDetail\1#g' \
  -e 's#pages/detailPages/grandPrixDetail(["'"'"'])#components/GrandPrixDetail\1#g' \
  -e 's#pages/home(["'"'"'])#components/Home\1#g' \
  -e 's#pages/driver(["'"'"'])#components/Drivers\1#g' \
  -e 's#pages/constructors(["'"'"'])#components/Constructors\1#g' \
  -e 's#pages/circuit(["'"'"'])#components/Circuits\1#g' \
  -e 's#pages/grand_prix(["'"'"'])#components/GrandPrix\1#g' \
  -e 's#pages/statistics(["'"'"'])#components/Statistics\1#g' \
  -e 's#pages/login(["'"'"'])#components/Login\1#g' \
  -e 's#adminPages/AdminCrud(["'"'"'])#components/admin/AdminCrud\1#g' \
  -e 's#adminPages/adminDriverPage(["'"'"'])#components/admin/AdminDrivers\1#g' \
  -e 's#adminPages/adminConstructorPage(["'"'"'])#components/admin/AdminConstructors\1#g' \
  -e 's#adminPages/adminCircuitPage(["'"'"'])#components/admin/AdminCircuits\1#g' \
  -e 's#adminPages/adminGrandPrixPage(["'"'"'])#components/admin/AdminGrandPrix\1#g' \
  -e 's#adminPages/adminStatistics(["'"'"'])#components/admin/AdminResults\1#g' \
  -e 's#\./AdminCrud(["'"'"'])#./AdminCrud\1#g' \
  $TS

# --- 6. Vite környezeti változók -----------------------------------
sed -i -E \
  -e 's#process\.env\.REACT_APP_SUPABASE_PUBLISHABLE_KEY#import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY#g' \
  -e 's#process\.env\.REACT_APP_SUPABASE_ANON_KEY#import.meta.env.VITE_SUPABASE_ANON_KEY#g' \
  -e 's#process\.env\.REACT_APP_SUPABASE_URL#import.meta.env.VITE_SUPABASE_URL#g' \
  -e 's#REACT_APP_SUPABASE#VITE_SUPABASE#g' \
  $TS

echo
echo "Kész. Következő: npm install, majd npm run dev"

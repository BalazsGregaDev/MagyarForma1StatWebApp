// ---------------------------------------------------------------------
//  src/components/Footer.tsx
//
//  Kötelező lábléc-nyilatkozat. Az F1 saját irányelvei (formula1.com
//  /en/information/guidelines) pontosan ezt a szöveget írják elő nem
//  hivatalos rajongói oldalakhoz. Nulla költség, és ez az egyetlen olyan
//  elem, amit a jogtulajdonos maga kér.
//
//  Lásd: kephasznalat_es_jogok.md, 3. fejezet.
// ---------------------------------------------------------------------
import React from "react";
import { Link } from "react-router-dom";

/** Cseréld a saját, védjegymentes márkanevedre (pl. Boxutca, Gridline). */
export const SITE_NAME = "Gridline";

const Footer: React.FC = () => (
  <footer className="site-footer">
    <div className="site-footer__links">
      <Link to="/">{SITE_NAME}</Link>
      <Link to="/about">Rólunk</Link>
      <Link to="/privacy">Adatvédelem</Link>
      <Link to="/attributions">Képek forrásai</Link>
    </div>

    <p className="site-footer__disclaimer">
      This website is unofficial and is not associated in any way with the
      Formula 1 companies. F1, FORMULA ONE, FORMULA 1, FIA FORMULA ONE WORLD
      CHAMPIONSHIP, GRAND PRIX and related marks are trade marks of Formula One
      Licensing B.V.
    </p>

    <p className="site-footer__meta">
      © {new Date().getFullYear()} {SITE_NAME}. Pályarajzok:{" "}
      <a
        href="https://www.openstreetmap.org/copyright"
        target="_blank"
        rel="noopener noreferrer"
      >
        © OpenStreetMap contributors
      </a>{" "}
      (ODbL).
    </p>
  </footer>
);

export default Footer;
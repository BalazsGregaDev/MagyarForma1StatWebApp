// ---------------------------------------------------------------------
//  src/components/DriverAvatar.tsx
//
//  Generált SVG-avatar rajtszámból és csapatszínből.
//
//  Ez váltja ki a 24 hivatalos F1 versenyzőportrét (drivers-image-map.tsx),
//  amelyek szerzői jogvédettek és a monetizáció előtt cserélendők —
//  lásd kephasznalat_es_jogok.md.
//
//  Előnyök:
//   - nulla jogi kockázat (nincs fotó, nincs képmás)
//   - definíció szerint egységes, mert generált
//   - ~1 kB SVG a jelenlegi ~9,2 MB képbundle helyett
//   - működik olyan versenyzőknél is, akikről nincs jó fotó
//
//  Ha a drivers.Image mezőben van saját/szabad licencű kép, azt használja;
//  ha nincs, visszaesik a generált avatarra.
// ---------------------------------------------------------------------
import React from "react";
import { teamGradient } from "../lib/api";

interface Props {
  name: string;
  number?: number | null;
  acronym?: string | null;
  teamColour?: string | null;
  image?: string | null;
  /** "number" (rajtszám) | "monogram" (kezdőbetűk) | "helmet" (sisak-sziluett) */
  variant?: "number" | "monogram" | "helmet";
  size?: number;
  className?: string;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Sötét háttéren fehér, világoson fekete szöveg. */
function contrastText(hex: string | null | undefined): string {
  if (!hex) return "#ffffff";
  const n = parseInt(hex.replace("#", ""), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? "#111111" : "#ffffff";
}

const DriverAvatar: React.FC<Props> = ({
  name,
  number,
  acronym,
  teamColour,
  image,
  variant = "number",
  size = 120,
  className = "",
}) => {
  // Ha van tényleges kép, azt jelenítjük meg egységes vágással.
  if (image) {
    return (
      <img
        src={image}
        alt={name}
        width={size}
        height={size}
        loading="lazy"
        className={`driver-avatar driver-avatar--photo ${className}`}
        style={{
          width: size,
          height: size,
          objectFit: "cover",
          borderRadius: "50%",
          border: "3px solid #000",
          background: teamGradient(teamColour ?? null),
        }}
      />
    );
  }

  const colour = teamColour ?? "#3a3a3a";
  const fg = contrastText(colour);
  const gradId = `grad-${(acronym ?? name).replace(/\W/g, "")}`;

  const label =
    variant === "monogram"
      ? (acronym ?? initials(name))
      : number != null
        ? String(number)
        : (acronym ?? initials(name));

  return (
    <svg
      viewBox="0 0 120 120"
      width={size}
      height={size}
      role="img"
      aria-label={name}
      className={`driver-avatar driver-avatar--generated ${className}`}
    >
      <title>{name}</title>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={colour} />
          <stop offset="100%" stopColor="#111111" />
        </linearGradient>
      </defs>

      {/* Fekete kontrasztos border – a pixel art stílushoz igazodva */}
      <circle cx="60" cy="60" r="57" fill={`url(#${gradId})`} stroke="#000" strokeWidth="6" />

      {variant === "helmet" ? (
        <>
          {/* Általános sisakforma – NEM a versenyző valódi sisakdizájnja */}
          <path
            d="M60 28c-18 0-31 13-31 31v10c0 5 4 9 9 9h9l4-8h30c8 0 14-6 14-14v-6c0-18-13-22-35-22z"
            fill={fg}
            opacity="0.92"
            stroke="#000"
            strokeWidth="3"
          />
          <path d="M40 58h34c2 0 3 2 2 4l-3 6H42c-2 0-3-2-2-4z" fill={colour} stroke="#000" strokeWidth="2" />
          <text
            x="60" y="100" textAnchor="middle"
            fontSize="18" fontWeight="800" fill={fg}
            fontFamily="'Segoe UI', system-ui, sans-serif"
            letterSpacing="1"
          >
            {acronym ?? initials(name)}
          </text>
        </>
      ) : (
        <>
          <text
            x="60"
            y={variant === "number" ? 74 : 70}
            textAnchor="middle"
            fontSize={label.length > 2 ? 40 : 52}
            fontWeight="900"
            fill={fg}
            fontFamily="'Segoe UI', system-ui, sans-serif"
            letterSpacing="-1"
            stroke="#000"
            strokeWidth="1.5"
            paintOrder="stroke"
          >
            {label}
          </text>
          {variant === "number" && acronym && (
            <text
              x="60" y="96" textAnchor="middle"
              fontSize="15" fontWeight="700" fill={fg}
              fontFamily="'Segoe UI', system-ui, sans-serif"
              letterSpacing="2" opacity="0.85"
            >
              {acronym}
            </text>
          )}
        </>
      )}
    </svg>
  );
};

export default DriverAvatar;
// ---------------------------------------------------------------------
//  src/pages/home.tsx
//
//  Változások:
//   - a hírek az Edge Functionből jönnek (cache-elve), nem a Laravel
//     /api/news végpontról, ami minden betöltésnél hívta a formula1.com-ot
//   - ha a hírek nem érhetők el, a kártya nem tűnik el, csak jelzi
//   - a hírek közötti automatikus léptetés megáll, ha a felhasználó
//     kézzel lapoz (a régi verzió tovább ugrált a kezed alatt)
// ---------------------------------------------------------------------
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import api, { teamGradient, type NewsItem } from "../lib/api";
import type { Driver, Constructor } from "../lib/database.types";
import DriverAvatar from "../components/DriverAvatar";
import "../styles/home.css";

/** "Ezen a napon" – statikus, saját szerkesztésű tartalom.
 *  Bővíthető; kulcs formátuma "MM-DD". */
const F1_HISTORY: Record<string, { year: number; text: string }[]> = {
  "05-13": [{ year: 1950, text: "Az első Formula 1 világbajnoki futam Silverstone-ban." }],
  "08-04": [{ year: 2024, text: "Oscar Piastri első futamgyőzelme Magyarországon." }],
};

function todayKey(): string {
  const d = new Date();
  return `${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const HomePage: React.FC = () => {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [constructors, setConstructors] = useState<Constructor[]>([]);
  const [newsItems, setNewsItems] = useState<NewsItem[]>([]);
  const [newsError, setNewsError] = useState(false);
  const [activeNews, setActiveNews] = useState(0);
  const [tab, setTab] = useState<"drivers" | "constructors">("drivers");
  const [loading, setLoading] = useState(true);

  /** Ha a felhasználó kézzel lapoz, leáll az automatikus forgatás. */
  const [autoRotate, setAutoRotate] = useState(true);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let active = true;

    Promise.all([api.drivers.list(), api.constructors.list()])
      .then(([d, c]) => {
        if (!active) return;
        setDrivers(d);
        setConstructors(c);
      })
      .catch(() => {})
      .finally(() => active && setLoading(false));

    // A hírek külön futnak: ha elszállnak, az oldal többi része már látszik.
    api.news
      .latest()
      .then((n) => active && setNewsItems(n))
      .catch(() => active && setNewsError(true));

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!autoRotate || newsItems.length < 2) return;
    timer.current = setInterval(
      () => setActiveNews((i) => (i + 1) % newsItems.length),
      5000,
    );
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [autoRotate, newsItems.length]);

  const history = useMemo(
    () => F1_HISTORY[todayKey()] ?? [{ year: 1950, text: "A Formula 1 világbajnokság első szezonja." }],
    [],
  );

  const colourOf = (id: number | null) =>
    constructors.find((c) => c.ConstructorID === id)?.TeamColour ?? null;

  const current = newsItems[activeNews];

  return (
    <div className="home-page">
      <div className="home-main-grid">
        {/* ---------------- Hírek ---------------- */}
        <section className="home-news-card">
          <div className="home-news-badge">Legfrissebb hírek</div>

          {newsError ? (
            <div className="home-news-loading">
              A hírek most nem érhetők el. Próbáld később.
            </div>
          ) : !current ? (
            <div className="home-news-loading">Hírek betöltése…</div>
          ) : (
            <>
              <h2 className="home-news-title">{current.title}</h2>
              {current.description && <p>{current.description}</p>}
              <div className="home-news-meta">
                <span>{current.pubDate}</span>
                <a
                  className="home-news-link"
                  href={current.link}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Tovább olvasom →
                </a>
              </div>
              <div className="home-news-tabs">
                {newsItems.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    aria-label={`${i + 1}. hír`}
                    className={i === activeNews ? "active" : ""}
                    onClick={() => {
                      setActiveNews(i);
                      setAutoRotate(false);
                    }}
                  />
                ))}
              </div>
              <small style={{ opacity: 0.6 }}>Forrás: Formula1.com</small>
            </>
          )}
        </section>

        {/* ---------------- Ezen a napon ---------------- */}
        <aside className="home-history-card">
          <div className="home-history-label">Ezen a napon</div>
          {history.map((h, i) => (
            <div className="home-history-item" key={i}>
              <span className="home-history-date">{h.year}</span>
              <span>{h.text}</span>
            </div>
          ))}
        </aside>
      </div>

      {/* ---------------- Gyorslinkek ---------------- */}
      <section className="home-tabs-section">
        <div className="home-tabs-header">
          <button
            type="button"
            className={tab === "drivers" ? "active" : ""}
            onClick={() => setTab("drivers")}
          >
            Versenyzők
          </button>
          <button
            type="button"
            className={tab === "constructors" ? "active" : ""}
            onClick={() => setTab("constructors")}
          >
            Csapatok
          </button>
        </div>

        {loading ? (
          <div className="home-news-loading">Betöltés…</div>
        ) : (
          <div className="home-tabs-body">
            {tab === "drivers"
              ? drivers.map((d) => (
                  <Link
                    key={d.DriverID}
                    to={`/driver/${d.DriverID}`}
                    className="home-mini-card"
                    style={{ background: teamGradient(colourOf(d.ConstructorID)) }}
                  >
                    <DriverAvatar
                      name={d.Name}
                      number={d.DriverNumber}
                      acronym={d.Acronym}
                      teamColour={colourOf(d.ConstructorID)}
                      image={d.Image || null}
                      size={56}
                    />
                    <span>{d.Name}</span>
                  </Link>
                ))
              : constructors.map((c) => (
                  <Link
                    key={c.ConstructorID}
                    to={`/constructor/${c.ConstructorID}`}
                    className="home-mini-card"
                    style={{ background: teamGradient(c.TeamColour) }}
                  >
                    <span>{c.Name}</span>
                  </Link>
                ))}
          </div>
        )}
      </section>
    </div>
  );
};

export default HomePage;
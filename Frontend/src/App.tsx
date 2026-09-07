import React from "react";
import { BrowserRouter as Router, Routes, Route, Link } from "react-router-dom";



import Navbar from "./components/Navbar";
import ProtectedRoute from "./components/ProtectedRoute";

import HomePage from "./components/Home";
import GrandPrixPage from "./components/GrandPrix";
import DriversPage from "./components/Drivers";
import ConstructorPage from "./components/Constructors";
import CircuitPage from "./components/Circuits";
import LoginPage from "./components/Login";
import StatisticsPage from "./components/Statistics";

import DriverDetailPage from "./components/DriverDetail";
import GrandPrixDetailPage from "./components/GrandPrixDetail";
import ConstructorDetailPage from "./components/ConstructorDetail";
import CircuitDetailPage from "./components/CircuitDetail";

import AdminDriverPage from "./components/admin/AdminDrivers";
import AdminGrandPrixPage from "./components/admin/AdminGrandPrix";
import AdminConstructorPage from "./components/admin/AdminConstructors";
import AdminCircuitPage from "./components/admin/AdminCircuits";
import AdminStatisticsPage from "./components/admin/AdminResults";

import { ThemeProvider } from "./components/ThemeContext";
import { AuthProvider } from "./AuthContext";
import { SITE_NAME } from "./config";

import "./Styles/index.css";
import "./Styles/navbar.css";
import "./Styles/home.css";

const admin = (element: React.ReactNode) => (
  <ProtectedRoute>{element}</ProtectedRoute>
);

const App: React.FC = () => (
  <ThemeProvider>
    <AuthProvider>
      <Router>
        <div className="app-shell">
          <Navbar />

          <main className="content">
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/statistics" element={<StatisticsPage />} />
              <Route path="/grand_prix" element={<GrandPrixPage />} />
              <Route path="/grandprix/:id" element={<GrandPrixDetailPage />} />
              <Route path="/driver" element={<DriversPage />} />
              <Route path="/driver/:id" element={<DriverDetailPage />} />
              <Route path="/constructor" element={<ConstructorPage />} />
              <Route
                path="/constructor/:id"
                element={<ConstructorDetailPage />}
              />
              <Route path="/circuit" element={<CircuitPage />} />
              <Route path="/circuit/:id" element={<CircuitDetailPage />} />
              <Route path="/login" element={<LoginPage />} />

              <Route
                path="/admin/drivers"
                element={admin(<AdminDriverPage />)}
              />
              <Route
                path="/admin/grandprix"
                element={admin(<AdminGrandPrixPage />)}
              />
              <Route
                path="/admin/constructors"
                element={admin(<AdminConstructorPage />)}
              />
              <Route
                path="/admin/circuits"
                element={admin(<AdminCircuitPage />)}
              />
              <Route
                path="/admin/statistics"
                element={admin(<AdminStatisticsPage />)}
              />

              <Route
                path="*"
                element={
                  <div className="page-state">404 – Az oldal nem található</div>
                }
              />
            </Routes>
          </main>

          {/* Lábléc. A nyilatkozat szövegét az F1 saját irányelvei írják elő
              nem hivatalos rajongói oldalakhoz — ne írd át. */}
          <footer className="site-footer">
            <Link to="/" className="site-footer__brand">
              {SITE_NAME}
            </Link>

            <p className="site-footer__disclaimer">
              This website is unofficial and is not associated in any way with
              the Formula 1 companies. F1, FORMULA ONE, FORMULA 1, FIA FORMULA
              ONE WORLD CHAMPIONSHIP, GRAND PRIX and related marks are trade
              marks of Formula One Licensing B.V.
            </p>

            <p className="site-footer__meta">
              © {new Date().getFullYear()} {SITE_NAME}
            </p>
          </footer>
        </div>
      </Router>
    </AuthProvider>
  </ThemeProvider>
);

export default App;

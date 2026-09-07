import React from "react";
import { BrowserRouter as Router, Routes, Route, Link } from "react-router-dom";

import Navbar from "./components/navbar";
import ProtectedRoute from "./components/ProtectedRoute";

import HomePage from "./pages/home";
import GrandPrixPage from "./pages/grand_prix";
import DriversPage from "./pages/driver";
import ConstructorPage from "./pages/constructors";
import CircuitPage from "./pages/circuit";
import LoginPage from "./pages/login";
import StatisticsPage from "./pages/statistics";

import AdminDriverPage from "./adminPages/adminDriverPage";
import AdminGrandPrixPage from "./adminPages/adminGrandPrixPage";
import AdminConstructorPage from "./components/admin/adminConstructors";
import AdminCircuitPage from "./components/admin/adminCircuits";
import AdminStatisticsPage from "./adminPages/adminStatistics";

import DriverDetailPage from "./pages/detailPages/driverDetail";
import GrandPrixDetailPage from "./pages/detailPages/grandPrixDetail";
import ConstructorDetailPage from "./pages/detailPages/constructorDetail";
import CircuitDetailPage from "./pages/detailPages/circuitDetail";

import { ThemeProvider } from "./components/themeContext";
import { AuthProvider } from "./AuthContext";
import { SITE_NAME } from "./config";

import "./styles/index.css";
import "./styles/navbar.css";
import "./styles/home.css";

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

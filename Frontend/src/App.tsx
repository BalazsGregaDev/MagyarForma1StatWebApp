// ---------------------------------------------------------------------
//  src/App.tsx
//
//  Változások a régihez képest:
//   - <AuthProvider> a fa tetején (a localStorage("role") helyett)
//   - az /admin/* útvonalak <ProtectedRoute> mögött
//   - az isAdmin propokat a komponensek a useAuth() hookkal kérik le,
//     így nem kell prop drillinggel végigvinni
// ---------------------------------------------------------------------
import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";

import Navbar from "./components/navbar";
import ProtectedRoute from "./components/ProtectedRoute";
import Footer from "./components/Footer";

import HomePage from "./pages/home";
import GrandPrixPage from "./pages/grand_prix";
import DriversPage from "./pages/driver";
import ConstructorPage from "./pages/constructors";
import CircuitPage from "./pages/circuit";
import LoginPage from "./pages/login";
import StatisticsPage from "./pages/statistics";

import AdminDriverPage from "./adminPages/adminDriverPage";
import AdminGrandPrixPage from "./adminPages/adminGrandPrixPage";
import AdminConstructorPage from "./adminPages/adminConstructorPage";
import AdminCircuitPage from "./adminPages/adminCircuitPage";
import AdminStatisticsPage from "./adminPages/adminStatistics";

import DriverDetailPage from "./pages/detailPages/driverDetail";
import GrandPrixDetailPage from "./pages/detailPages/grandPrixDetail";
import ConstructorDetailPage from "./pages/detailPages/constructorDetail";
import CircuitDetailPage from "./pages/detailPages/circuitDetail";

import { ThemeProvider } from "./components/themeContext";
import { AuthProvider } from "./lib/AuthContext";

import "./styles/index.css";
import "./styles/navbar.css";
import "./styles/home.css";

const admin = (element: React.ReactNode) => <ProtectedRoute>{element}</ProtectedRoute>;

const App: React.FC = () => (
  <ThemeProvider>
    <AuthProvider>
      <Router>
        <Navbar />

        <div className="content">
          <Routes>
            {/* Publikus */}
            <Route path="/" element={<HomePage />} />
            <Route path="/statistics" element={<StatisticsPage />} />
            <Route path="/grand_prix" element={<GrandPrixPage />} />
            <Route path="/grandprix/:id" element={<GrandPrixDetailPage />} />
            <Route path="/driver" element={<DriversPage />} />
            <Route path="/driver/:id" element={<DriverDetailPage />} />
            <Route path="/constructor" element={<ConstructorPage />} />
            <Route path="/constructor/:id" element={<ConstructorDetailPage />} />
            <Route path="/circuit" element={<CircuitPage />} />
            <Route path="/circuit/:id" element={<CircuitDetailPage />} />
            <Route path="/login" element={<LoginPage />} />

            {/* Adminisztrátori – bejelentkezés és admin szerepkör szükséges */}
            <Route path="/admin/drivers" element={admin(<AdminDriverPage />)} />
            <Route path="/admin/grandprix" element={admin(<AdminGrandPrixPage />)} />
            <Route path="/admin/constructors" element={admin(<AdminConstructorPage />)} />
            <Route path="/admin/circuits" element={admin(<AdminCircuitPage />)} />
            <Route path="/admin/statistics" element={admin(<AdminStatisticsPage />)} />

            <Route path="*" element={<div className="page-state">404 – Az oldal nem található</div>} />
          </Routes>
        </div>

        <Footer />
      </Router>
    </AuthProvider>
  </ThemeProvider>
);

export default App;
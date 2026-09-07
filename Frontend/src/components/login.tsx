// ---------------------------------------------------------------------
//  src/pages/login.tsx  (Supabase Auth)
//
//  A régi folyamat: GET /sanctum/csrf-cookie -> getCookie("XSRF-TOKEN")
//  -> POST /api/login X-XSRF-TOKEN fejléccel -> localStorage.setItem("role").
//
//  Az új: egyetlen signIn() hívás. A token kezelését, frissítését és
//  tárolását a supabase-js intézi.
// ---------------------------------------------------------------------
import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../AuthContext";
import "../styles/login.css";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const LoginPage: React.FC = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{
    email?: string;
    password?: string;
    form?: string;
  }>({});
  const [submitting, setSubmitting] = useState(false);

  const { signIn, isAdmin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? "/";

  const validate = () => {
    const next: typeof errors = {};
    if (!email.trim()) next.email = "Az e-mail cím megadása kötelező.";
    else if (!EMAIL_RE.test(email))
      next.email = "Az e-mail cím formátuma érvénytelen.";
    if (!password) next.password = "A jelszó megadása kötelező.";
    else if (password.length < 6)
      next.password = "A jelszó legalább 6 karakter.";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setSubmitting(true);
    setErrors({});
    try {
      await signIn(email.trim(), password);
      navigate(from, { replace: true });
    } catch (err) {
      setErrors({
        form:
          err instanceof Error ? err.message : "A bejelentkezés nem sikerült.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <h1 className="login-title">Bejelentkezés</h1>
        <p className="login-subtitle">Adminisztrátori hozzáférés</p>

        {errors.form && (
          <div className="login-error login-error--form" role="alert">
            {errors.form}
          </div>
        )}

        <label className="login-label" htmlFor="email">
          E-mail
        </label>
        <input
          id="email"
          type="email"
          autoComplete="username"
          className="login-input"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          disabled={submitting}
        />
        {errors.email && <span className="login-error">{errors.email}</span>}

        <label className="login-label" htmlFor="password">
          Jelszó
        </label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          className="login-input"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          disabled={submitting}
        />
        {errors.password && (
          <span className="login-error">{errors.password}</span>
        )}

        {/* FONTOS: <form> helyett gomb + onClick. React artifactokban és
            SPA-ban a form submit teljes oldalújratöltést okozhat. */}
        <button
          type="button"
          className="login-button"
          onClick={handleSubmit}
          disabled={submitting}
        >
          {submitting ? "Bejelentkezés…" : "Belépés"}
        </button>

        {!isAdmin && (
          <p className="login-hint">
            Ha be tudsz jelentkezni, de nem látod az adminisztrációs menüt, a
            fiókodnak még nincs admin szerepköre. A Supabase SQL Editorban:
            <code>UPDATE profiles SET role = 'admin' WHERE email = '…';</code>
          </p>
        )}
      </div>
    </div>
  );
};

export default LoginPage;

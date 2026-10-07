import { useState } from "react";
import { supabase } from "./supabase";
import "./styles.css";

export default function Login({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);
  const [modo, setModo] = useState("login"); // "login" | "reset"
  const [resetEnviado, setResetEnviado] = useState(false);

  async function iniciarSesion(e) {
    e.preventDefault();
    setError("");
    if (!email.trim() || !password.trim()) { setError("Completá todos los campos."); return; }
    setCargando(true);

    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });

    if (authError || !authData.user) {
      setCargando(false);
      setError("Email o contraseña incorrectos.");
      return;
    }

    const { data: perfil, error: perfilError } = await supabase
      .from("usuarios")
      .select("id, empresa, contacto, usuario, email, rol, activo, agencia_id")
      .eq("id", authData.user.id)
      .single();

    setCargando(false);

    if (perfilError || !perfil) {
      await supabase.auth.signOut();
      setError("No se encontró el perfil del usuario.");
      return;
    }

    if (!perfil.activo) {
      await supabase.auth.signOut();
      setError("Tu cuenta está suspendida. Contactá a Pristine.");
      return;
    }

    onLogin(perfil.rol, perfil);
  }

  async function enviarReset(e) {
    e.preventDefault();
    setError("");
    if (!email.trim()) { setError("Ingresá tu email."); return; }
    setCargando(true);
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      email.trim().toLowerCase(),
      { redirectTo: "http://localhost:5173" }
    );
    setCargando(false);
    if (resetError) { setError("Error al enviar el email: " + resetError.message); return; }
    setResetEnviado(true);
  }

  return (
    <div className="login-screen">
      <div className="login-wrap">
        <div className="login-brand">
          <div className="login-brand-name">PRISTINE</div>
          <div className="login-brand-sub">Portal de acceso</div>
        </div>
        <div className="login-card">
          <div className="login-card-head">
            <p>Acceso exclusivo para clientes y administradores</p>
          </div>
          <div className="login-card-body">
            {modo === "login" ? (
              <form onSubmit={iniciarSesion}>
                <div className="field">
                  <label className="field-label">Email</label>
                  <input
                    className="field-input"
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="correo@agencia.com"
                    autoFocus
                  />
                </div>
                <div className="field">
                  <label className="field-label">Contraseña</label>
                  <input
                    className="field-input"
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                  />
                </div>
                {error && <p className="error-text">{error}</p>}
                <button type="submit" className="btn btn-gold btn-full" disabled={cargando}>
                  {cargando ? "Verificando..." : "Ingresar"}
                </button>
                <p style={{ textAlign: "center", marginTop: 14, fontSize: ".85rem" }}>
                  <button
                    type="button"
                    onClick={() => { setModo("reset"); setError(""); setResetEnviado(false); }}
                    style={{ background: "none", border: "none", color: "var(--gold)", cursor: "pointer", textDecoration: "underline" }}
                  >
                    Olvidé mi contraseña
                  </button>
                </p>
              </form>
            ) : resetEnviado ? (
              <div style={{ textAlign: "center" }}>
                <p style={{ marginBottom: 16 }}>Te enviamos un email con el link para restablecer tu contraseña. Revisá tu bandeja de entrada.</p>
                <button className="btn btn-outline btn-full" onClick={() => { setModo("login"); setResetEnviado(false); }}>
                  Volver al login
                </button>
              </div>
            ) : (
              <form onSubmit={enviarReset}>
                <p style={{ marginBottom: 16, fontSize: ".9rem" }}>Ingresá tu email y te enviamos un link para restablecer tu contraseña.</p>
                <div className="field">
                  <label className="field-label">Email</label>
                  <input
                    className="field-input"
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="correo@agencia.com"
                    autoFocus
                  />
                </div>
                {error && <p className="error-text">{error}</p>}
                <button type="submit" className="btn btn-gold btn-full" disabled={cargando}>
                  {cargando ? "Enviando..." : "Enviar email"}
                </button>
                <p style={{ textAlign: "center", marginTop: 14, fontSize: ".85rem" }}>
                  <button
                    type="button"
                    onClick={() => { setModo("login"); setError(""); }}
                    style={{ background: "none", border: "none", color: "var(--gold)", cursor: "pointer", textDecoration: "underline" }}
                  >
                    Volver al login
                  </button>
                </p>
              </form>
            )}
          </div>
        </div>
        <div className="login-footer">Pristine EVyT · Legajo 14747</div>
      </div>
    </div>
  );
}

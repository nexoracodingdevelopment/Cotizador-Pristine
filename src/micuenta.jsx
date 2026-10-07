import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { supabase } from "./supabase";
import "./styles.css";

export default function MiCuenta({ usuario, volver }) {
  const [actual, setActual] = useState("");
  const [nueva, setNueva] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");
  const [exito, setExito] = useState(false);
  const [emailEnviado, setEmailEnviado] = useState(false);
  const [enviando, setEnviando] = useState(false);

  async function cambiarPassword() {
    setError(""); setExito(false);
    if (!actual || !nueva || !confirmar) { setError("Completá todos los campos."); return; }
    if (nueva.length < 8) { setError("La nueva contraseña debe tener al menos 8 caracteres."); return; }
    if (nueva !== confirmar) { setError("Las contraseñas no coinciden."); return; }
    setCargando(true);

    const { error: loginError } = await supabase.auth.signInWithPassword({
      email: usuario.email,
      password: actual,
    });

    if (loginError) {
      setCargando(false);
      setError("La contraseña actual es incorrecta.");
      return;
    }

    const { error: updateError } = await supabase.auth.updateUser({ password: nueva });
    setCargando(false);
    if (updateError) { setError("Error al actualizar: " + updateError.message); return; }

    setExito(true);
    setActual(""); setNueva(""); setConfirmar("");
  }

  async function enviarEmailReset() {
    setEnviando(true);
    await supabase.auth.resetPasswordForEmail(usuario.email, {
      redirectTo: "http://localhost:5173",
    });
    setEnviando(false);
    setEmailEnviado(true);
  }

  return (
    <div style={{ minHeight: "100vh" }}>
      <header className="topbar">
        <div className="topbar-brand">PRISTINE<span>Mi cuenta</span></div>
        <button className="btn-back" onClick={volver}><ArrowLeft size={14} /> Volver</button>
      </header>

      <div style={{ maxWidth: 680, margin: "0 auto", padding: "44px 24px" }}>
        <div className="page-header">
          <div className="page-eyebrow">Portal</div>
          <h1 className="page-title">Mi cuenta</h1>
        </div>

        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-title">Tus datos</div>
          <div className="datos-grid">
            {[["Empresa", usuario?.empresa], ["Contacto", usuario?.contacto], ["Usuario", usuario?.usuario], ["Email", usuario?.email], ["Rol", usuario?.rol]].map(([label, valor]) => (
              <div className="dato-item" key={label}>
                <div className="dato-label">{label}</div>
                <div className="dato-valor">{valor || "—"}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="card-title">Cambiar contraseña</div>
          <p className="page-sub" style={{ marginBottom: 20 }}>Mínimo 8 caracteres.</p>

          {exito && <div className="flash flash-ok">Contraseña actualizada correctamente.</div>}

          {[["Contraseña actual", actual, setActual], ["Nueva contraseña", nueva, setNueva], ["Confirmar nueva contraseña", confirmar, setConfirmar]].map(([label, val, setter]) => (
            <div className="field" key={label}>
              <label className="field-label">{label}</label>
              <input type="password" className="field-input" value={val} onChange={e => { setter(e.target.value); setError(""); setExito(false); }} />
            </div>
          ))}

          {error && <p className="error-text">{error}</p>}

          <button className="btn btn-gold btn-full" onClick={cambiarPassword} disabled={cargando}>
            {cargando ? "Guardando..." : "Actualizar contraseña"}
          </button>

          <div style={{ marginTop: 20, paddingTop: 20, borderTop: "1px solid var(--border)" }}>
            <p style={{ fontSize: ".85rem", color: "var(--text-soft)", marginBottom: 10 }}>
              ¿No recordás tu contraseña actual?
            </p>
            {emailEnviado ? (
              <p style={{ fontSize: ".85rem", color: "var(--green)" }}>
                Te enviamos un email con el link para cambiar tu contraseña.
              </p>
            ) : (
              <button
                className="btn btn-outline btn-full"
                onClick={enviarEmailReset}
                disabled={enviando}
              >
                {enviando ? "Enviando..." : "Recibir email para cambiar contraseña"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

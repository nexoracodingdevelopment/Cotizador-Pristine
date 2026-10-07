import { useState, useEffect } from "react";
import { supabase } from "./supabase";
import login from "./login";
import admindashboard from "./admindashboard";
import nuevousuario from "./nuevousuario";
import dashboard from "./dashboard";
import Cotizador from "./cotizador-pristine";
import GestorUsuarios from "./gestorusuarios";
import MiCuenta from "./micuenta";
import HistorialCotizaciones from "./historialcotizaciones";
import GestorClientes from "./gestorclientes";
import GestorPasajeros from "./gestorpasajeros";

function NuevaPassword({ onDone }) {
  const [nueva, setNueva] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);
  const [exito, setExito] = useState(false);

  async function guardar(e) {
    e.preventDefault();
    setError("");
    if (!nueva || !confirmar) { setError("Completá todos los campos."); return; }
    if (nueva.length < 8) { setError("Mínimo 8 caracteres."); return; }
    if (nueva !== confirmar) { setError("Las contraseñas no coinciden."); return; }
    setCargando(true);
    const { error: updateError } = await supabase.auth.updateUser({ password: nueva });
    setCargando(false);
    if (updateError) { setError("Error: " + updateError.message); return; }
    setExito(true);
    setTimeout(() => onDone(), 2000);
  }

  return (
    <div className="login-screen">
      <div className="login-wrap">
        <div className="login-brand">
          <div className="login-brand-name">PRISTINE</div>
          <div className="login-brand-sub">Nueva contraseña</div>
        </div>
        <div className="login-card">
          <div className="login-card-body">
            {exito ? (
              <p style={{ textAlign: "center" }}>Contraseña actualizada. Redirigiendo...</p>
            ) : (
              <form onSubmit={guardar}>
                <div className="field">
                  <label className="field-label">Nueva contraseña</label>
                  <input className="field-input" type="password" value={nueva} onChange={e => setNueva(e.target.value)} placeholder="Mínimo 8 caracteres" autoFocus />
                </div>
                <div className="field">
                  <label className="field-label">Confirmar contraseña</label>
                  <input className="field-input" type="password" value={confirmar} onChange={e => setConfirmar(e.target.value)} placeholder="Repetí la contraseña" />
                </div>
                {error && <p className="error-text">{error}</p>}
                <button type="submit" className="btn btn-gold btn-full" disabled={cargando}>
                  {cargando ? "Guardando..." : "Guardar contraseña"}
                </button>
              </form>
            )}
          </div>
        </div>
        <div className="login-footer">Pristine EVyT · Legajo 14747</div>
      </div>
    </div>
  );
}

export default function App() {
  const [pantalla, setPantalla] = useState("login");
  const [usuarioActual, setUsuarioActual] = useState(null);
  const [cotizacionAbierta, setCotizacionAbierta] = useState(null);
  const [resetMode, setResetMode] = useState(false);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setResetMode(true);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  function cerrarSesion() {
    supabase.auth.signOut();
    setUsuarioActual(null);
    setPantalla("login");
  }

  function pantallaAnterior() {
    return usuarioActual?.rol === "admin" ? "admin" : "dashboard";
  }

  if (resetMode) {
    return <NuevaPassword onDone={() => { setResetMode(false); setPantalla("login"); }} />;
  }

  if (pantalla === "login") {
    const Login = login;
    return (
      <Login
        onLogin={(rol, userData) => {
          setUsuarioActual(userData);
          if (rol === "admin") {
            setPantalla("admin");
          } else {
            setPantalla("dashboard");
          }
        }}
      />
    );
  }

  if (pantalla === "admin") {
    const Admin = admindashboard;
    return (
      <Admin
        usuario={usuarioActual}
        nuevoUsuario={() => setPantalla("nuevo")}
        nuevaCotizacion={() => setPantalla("cotizador")}
        cerrarSesion={cerrarSesion}
        gestionarUsuarios={() => setPantalla("gestionar")}
        historial={() => setPantalla("historial")}
        clientes={() => setPantalla("clientes")}
        pasajeros={() => setPantalla("pasajeros")}
      />
    );
  }

  if (pantalla === "dashboard") {
    const Dashboard = dashboard;
    return (
      <Dashboard
        usuario={usuarioActual}
        nuevaCotizacion={() => setPantalla("cotizador")}
        cerrarSesion={cerrarSesion}
        miCuenta={() => setPantalla("cuenta")}
        historial={() => setPantalla("historial")}
        clientes={() => setPantalla("clientes")}
        pasajeros={() => setPantalla("pasajeros")}
      />
    );
  }

  if (pantalla === "nuevo") {
    const Nuevo = nuevousuario;
    return <Nuevo volver={() => setPantalla("admin")} usuario={usuarioActual} />;
  }

  if (pantalla === "gestionar") {
    return <GestorUsuarios volver={() => setPantalla("admin")} usuario={usuarioActual} />;
  }

  if (pantalla === "cotizador") {
    return (
      <Cotizador
        usuario={usuarioActual}
        cotizacionInicial={cotizacionAbierta}
        volver={() => {
          setCotizacionAbierta(null);
          setPantalla(pantallaAnterior());
        }}
      />
    );
  }

  if (pantalla === "cuenta") {
    return <MiCuenta usuario={usuarioActual} volver={() => setPantalla("dashboard")} />;
  }

  if (pantalla === "historial") {
    return (
      <HistorialCotizaciones
        usuario={usuarioActual}
        volver={() => setPantalla(pantallaAnterior())}
        abrirCotizacion={(datos, id) => {
          setCotizacionAbierta({ datos, id });
          setPantalla("cotizador");
        }}
      />
    );
  }

  if (pantalla === "clientes") {
    return <GestorClientes usuario={usuarioActual} volver={() => setPantalla(pantallaAnterior())} />;
  }

  if (pantalla === "pasajeros") {
    return <GestorPasajeros usuario={usuarioActual} volver={() => setPantalla(pantallaAnterior())} />;
  }

  return null;
}

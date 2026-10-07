import { useEffect, useState } from "react";
import { ArrowLeft, Trash2, ShieldOff, ShieldCheck, RefreshCw } from "lucide-react";
import { supabase } from "./supabase";
import { supabaseAdmin } from "./supabaseAdmin";
import "./styles.css";

export default function GestorUsuarios({ volver, usuario: usuarioActual }) {
  const [usuarios, setUsuarios] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [confirmar, setConfirmar] = useState(null);
  const [procesando, setProcesando] = useState(false);
  const [flash, setFlash] = useState(null);

  useEffect(() => { cargar(); }, []);

  async function cargar() {
    setCargando(true);
    let query = supabase
      .from("usuarios")
      .select("id, empresa, contacto, usuario, email, rol, activo, creado_en, agencia_id")
      .order("creado_en", { ascending: false });

    if (usuarioActual?.rol !== "admin") {
      query = query.eq("agencia_id", usuarioActual.agencia_id);
    }

    const { data, error } = await query;
    setCargando(false);
    if (error) { mostrarFlash("Error: " + error.message, "error"); return; }
    setUsuarios(data || []);
  }

  async function toggleActivo(u) {
    setProcesando(true);
    const { error } = await supabase.from("usuarios").update({ activo: !u.activo }).eq("id", u.id);
    setProcesando(false);
    setConfirmar(null);
    if (error) { mostrarFlash("Error: " + error.message, "error"); return; }
    mostrarFlash(u.activo ? "Usuario suspendido." : "Usuario activado.", "ok");
    cargar();
  }

  async function eliminarUsuario(u) {
    setProcesando(true);
    const { error: dbError } = await supabase.from("usuarios").delete().eq("id", u.id);
    if (dbError) {
      setProcesando(false);
      setConfirmar(null);
      mostrarFlash("Error al eliminar perfil: " + dbError.message, "error");
      return;
    }
    await supabase.from("agencias").delete().eq("id", u.agencia_id);
    await supabaseAdmin.rpc("eliminar_auth_user", { user_id: u.id });
    setProcesando(false);
    setConfirmar(null);
    setUsuarios(prev => prev.filter(x => x.id !== u.id));
    mostrarFlash("Usuario eliminado.", "ok");
  }

  function mostrarFlash(texto, tipo) {
    setFlash({ texto, tipo });
    setTimeout(() => setFlash(null), 3000);
  }

  const filtrados = usuarios.filter(u => {
    const q = busqueda.toLowerCase();
    return u.empresa?.toLowerCase().includes(q) || u.usuario?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q);
  });

  return (
    <div style={{ minHeight: "100vh" }}>
      <header className="topbar">
        <div className="topbar-brand">PRISTINE<span>Gestión de usuarios</span></div>
        <button className="btn-back" onClick={volver}><ArrowLeft size={14} /> Volver</button>
      </header>

      <div style={{ maxWidth: 1080, margin: "0 auto", padding: "44px 24px" }}>
        <div className="page-header">
          <div className="page-eyebrow">Administración</div>
          <h1 className="page-title">Usuarios</h1>
        </div>

        <div className="toolbar">
          <div style={{ flex: 1 }}>
            <input className="field-input" value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Buscar por empresa, usuario o email..." />
          </div>
          <button className="btn btn-outline" onClick={cargar} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <RefreshCw size={14} /> Actualizar
          </button>
        </div>

        {flash && <div className={`flash flash-${flash.tipo}`}>{flash.texto}</div>}

        <div className="table-wrap">
          {cargando ? (
            <div className="empty-state">Cargando...</div>
          ) : filtrados.length === 0 ? (
            <div className="empty-state">{busqueda ? "Sin resultados." : "No hay usuarios registrados."}</div>
          ) : (
            <table>
              <thead>
                <tr>{["Empresa", "Usuario", "Email", "Contacto", "Estado", "Alta", ""].map(h => <th key={h}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {filtrados.map(u => (
                  <tr key={u.id}>
                    <td className="td-bold">{u.empresa}</td>
                    <td>{u.usuario}</td>
                    <td className="td-muted">{u.email}</td>
                    <td className="td-muted">{u.contacto}</td>
                    <td>
                      <span className={`badge ${u.activo ? "badge-active" : "badge-inactive"}`}>
                        {u.activo ? "Activo" : "Suspendido"}
                      </span>
                    </td>
                    <td className="td-muted">{new Date(u.creado_en).toLocaleDateString("es-AR")}</td>
                    <td>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button className="btn-icon" title={u.activo ? "Suspender" : "Activar"} onClick={() => setConfirmar({ tipo: u.activo ? "suspender" : "activar", usuario: u })}>
                          {u.activo ? <ShieldOff size={14} /> : <ShieldCheck size={14} />}
                        </button>
                        <button className="btn-icon danger" title="Eliminar" onClick={() => setConfirmar({ tipo: "eliminar", usuario: u })}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <p style={{ marginTop: 12, fontSize: ".75rem", color: "var(--text-soft)" }}>
          {filtrados.length} usuario{filtrados.length !== 1 ? "s" : ""}
        </p>
      </div>

      {confirmar && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-title">
              {confirmar.tipo === "eliminar" && "¿Eliminar usuario?"}
              {confirmar.tipo === "suspender" && "¿Suspender usuario?"}
              {confirmar.tipo === "activar" && "¿Activar usuario?"}
            </div>
            <p className="modal-body">
              {confirmar.tipo === "eliminar" && <><strong>{confirmar.usuario.empresa}</strong> se eliminará de forma permanente.</>}
              {confirmar.tipo === "suspender" && <><strong>{confirmar.usuario.usuario}</strong> no podrá iniciar sesión hasta que lo reactives.</>}
              {confirmar.tipo === "activar" && <><strong>{confirmar.usuario.usuario}</strong> podrá volver a iniciar sesión.</>}
            </p>
            <div className="modal-actions">
              <button className="btn btn-outline" onClick={() => setConfirmar(null)} disabled={procesando}>Cancelar</button>
              <button
                className={`btn ${confirmar.tipo === "eliminar" ? "btn-danger" : confirmar.tipo === "suspender" ? "btn-warn" : "btn-success"}`}
                onClick={() => confirmar.tipo === "eliminar" ? eliminarUsuario(confirmar.usuario) : toggleActivo(confirmar.usuario)}
                disabled={procesando}
              >
                {procesando ? "Procesando..." : confirmar.tipo === "eliminar" ? "Eliminar" : confirmar.tipo === "suspender" ? "Suspender" : "Activar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import { useEffect, useState } from "react";
import { ArrowLeft, FileText, Trash2, RefreshCw } from "lucide-react";
import { supabase } from "./supabase";
import "./styles.css";

const ESTADOS = {
  "en-curso":   { label: "En curso",   cls: "badge-navy" },
  "enviada":    { label: "Enviada",    cls: "badge-warn" },
  "aprobada":   { label: "Aprobada",  cls: "badge-active" },
  "cancelada":  { label: "Cancelada", cls: "badge-inactive" },
  "descartada": { label: "Descartada",cls: "badge-gray" },
};

export default function HistorialCotizaciones({ usuario, volver, abrirCotizacion }) {
  const [cotizaciones, setCotizaciones] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [confirmarEliminar, setConfirmarEliminar] = useState(null);
  const [flash, setFlash] = useState(null);

  useEffect(() => { cargar(); }, []);

  async function cargar() {
    setCargando(true);
    try {
      let query = supabase
        .from("cotizaciones")
        .select("id, numero, cliente, destino, estado, fecha_viaje, creado_en, actualizado_en")
        .order("actualizado_en", { ascending: false });
      if (usuario?.agencia_id) query = query.eq("agencia_id", usuario.agencia_id);
      if (usuario.rol !== "admin") query = query.eq("usuario_id", usuario.id);
      const { data, error } = await query;
      setCargando(false);
      if (error) { mostrarFlash("Error al cargar: " + error.message, "error"); return; }
      setCotizaciones(data || []);
    } catch (e) {
      setCargando(false);
      mostrarFlash("Error inesperado.", "error");
    }
  }

  async function eliminar(id) {
    const { error } = await supabase.from("cotizaciones").delete().eq("id", id);
    setConfirmarEliminar(null);
    if (error) { mostrarFlash("Error al eliminar.", "error"); return; }
    mostrarFlash("Cotización eliminada.", "ok");
    cargar();
  }

  async function abrirDetalle(cot) {
    const { data, error } = await supabase.from("cotizaciones").select("datos").eq("id", cot.id).single();
    if (error || !data) { mostrarFlash("No se pudo cargar.", "error"); return; }
    abrirCotizacion(data.datos, cot.id);
  }

  function mostrarFlash(texto, tipo) {
    setFlash({ texto, tipo });
    setTimeout(() => setFlash(null), 3000);
  }

  const filtradas = cotizaciones.filter(c => {
    const q = busqueda.toLowerCase();
    return c.cliente?.toLowerCase().includes(q) || c.destino?.toLowerCase().includes(q) || c.numero?.toLowerCase().includes(q);
  });

  return (
    <div style={{ minHeight: "100vh" }}>
      <header className="topbar">
        <div className="topbar-brand">PRISTINE<span>Cotizaciones</span></div>
        <button className="btn-back" onClick={volver}><ArrowLeft size={14} /> Volver</button>
      </header>

      <div style={{ maxWidth: 1080, margin: "0 auto", padding: "44px 24px" }}>
        <div className="page-header">
          <div className="page-eyebrow">{usuario.rol === "admin" ? "Administración" : "Mi portal"}</div>
          <h1 className="page-title">Cotizaciones</h1>
        </div>

        <div className="toolbar">
          <div style={{ flex: 1 }}>
            <input className="field-input" value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Buscar por cliente, destino o número..." />
          </div>
          <button className="btn btn-outline" onClick={cargar} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <RefreshCw size={14} /> Actualizar
          </button>
        </div>

        {flash && <div className={`flash flash-${flash.tipo}`}>{flash.texto}</div>}

        <div className="table-wrap">
          {cargando ? (
            <div className="empty-state">Cargando cotizaciones...</div>
          ) : filtradas.length === 0 ? (
            <div className="empty-state">{busqueda ? "Sin resultados." : "No hay cotizaciones todavía."}</div>
          ) : (
            <table>
              <thead>
                <tr>
                  {["N°", "Cliente", "Destino", "Fecha viaje", "Estado", "Actualizada", ""].map(h => <th key={h}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {filtradas.map(c => {
                  const est = ESTADOS[c.estado?.toLowerCase()] || { label: c.estado || "En curso", cls: "badge-navy" };
                  return (
                    <tr key={c.id}>
                      <td className="td-bold" style={{ color: "var(--navy)", fontFamily: "monospace", fontSize: ".8rem" }}>{c.numero || "—"}</td>
                      <td className="td-bold">{c.cliente || "—"}</td>
                      <td>{c.destino || "—"}</td>
                      <td className="td-muted">{c.fecha_viaje || "—"}</td>
                      <td><span className={`badge ${est.cls}`}>{est.label}</span></td>
                      <td className="td-muted">{new Date(c.actualizado_en).toLocaleDateString("es-AR")}</td>
                      <td>
                        <div style={{ display: "flex", gap: 6 }}>
                          <button className="btn-icon" title="Abrir" onClick={() => abrirDetalle(c)}><FileText size={14} /></button>
                          <button className="btn-icon danger" title="Eliminar" onClick={() => setConfirmarEliminar(c)}><Trash2 size={14} /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <p style={{ marginTop: 12, fontSize: ".75rem", color: "var(--text-soft)" }}>
          {filtradas.length} cotización{filtradas.length !== 1 ? "es" : ""}
        </p>
      </div>

      {confirmarEliminar && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-title">¿Eliminar cotización?</div>
            <p className="modal-body">Se eliminará permanentemente la cotización de <strong>{confirmarEliminar.cliente || "este cliente"}</strong>. No se puede deshacer.</p>
            <div className="modal-actions">
              <button className="btn btn-outline" onClick={() => setConfirmarEliminar(null)}>Cancelar</button>
              <button className="btn btn-danger" onClick={() => eliminar(confirmarEliminar.id)}>Eliminar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

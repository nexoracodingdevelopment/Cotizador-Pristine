import { useEffect, useState } from "react";
import { ArrowLeft, Plus, Trash2, RefreshCw, Search, X, User } from "lucide-react";
import { supabase } from "./supabase";

const TIPOS_DOC = ["DNI", "CUIT", "CUIL", "LC", "LE"];
const GENEROS = ["Masculino", "Femenino", "No binario", "Prefiero no decir"];

const VACIO_PASAJERO = {
  apellido: "",
  nombres: "",
  fecha_nacimiento: "",
  genero: "",
  nacionalidad: "",
  tipo_doc: "DNI",
  nro_documento: "",
  vencimiento_doc: "",
  tiene_pasaporte: false,
  pais_pasaporte: "",
  nro_pasaporte: "",
  vencimiento_pasaporte: "",
  email: "",
  telefono: "",
  cliente_id: null,
  observaciones: "",
};

function normalizar(s) {
  return (s || "").toUpperCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
}

function nombrePasajero(p) {
  const partes = [p.apellido, p.nombres].filter(Boolean);
  return partes.length ? partes.join(", ") : "(sin nombre)";
}

function nombreCliente(c) {
  if (!c) return "—";
  if (c.tipo === "persona_juridica") return c.razon_social || "(sin nombre)";
  const partes = [c.apellido, c.nombres].filter(Boolean);
  return partes.length ? partes.join(", ") : "(sin nombre)";
}

function edadDesde(fechaNac) {
  if (!fechaNac) return null;
  const hoy = new Date();
  const nac = new Date(fechaNac);
  let edad = hoy.getFullYear() - nac.getFullYear();
  const m = hoy.getMonth() - nac.getMonth();
  if (m < 0 || (m === 0 && hoy.getDate() < nac.getDate())) edad--;
  return edad;
}

function alertaVencimiento(fecha) {
  if (!fecha) return null;
  const hoy = new Date();
  const venc = new Date(fecha);
  const diff = (venc - hoy) / (1000 * 60 * 60 * 24);
  if (diff < 0) return "vencido";
  if (diff < 180) return "por vencer"; // menos de 6 meses
  return null;
}

function Field({ label, children, half, third }) {
  const flex = half ? "1 1 calc(50% - 8px)" : third ? "1 1 calc(33% - 8px)" : "1 1 100%";
  return (
    <div style={{ flex, minWidth: 0 }}>
      <label style={{ display: "block", fontSize: ".72rem", fontWeight: 700, color: "var(--text-soft)", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 4 }}>
        {label}
      </label>
      {children}
    </div>
  );
}

function Input({ value, onChange, placeholder, type = "text" }) {
  return (
    <input className="field-input" type={type} value={value || ""} onChange={onChange} placeholder={placeholder} />
  );
}

function Select({ value, onChange, options }) {
  return (
    <select className="field-input" value={value || ""} onChange={onChange}>
      <option value="">— seleccionar —</option>
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}

function BadgeAlerta({ estado }) {
  if (!estado) return null;
  const color = estado === "vencido" ? "#dc2626" : "#d97706";
  return (
    <span style={{ fontSize: ".7rem", fontWeight: 700, color, background: color + "18", padding: "1px 7px", borderRadius: 999, marginLeft: 6 }}>
      {estado === "vencido" ? "VENCIDO" : "POR VENCER"}
    </span>
  );
}

export default function GestorPasajeros({ volver, usuario }) {
  const agenciaId = usuario?.agencia_id;

  const [pasajeros, setPasajeros] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState([]);
  const [flash, setFlash] = useState(null);
  const [procesando, setProcesando] = useState(false);
  const [busqueda_str, setBusquedaStr] = useState("");

  const [ficha, setFicha] = useState(null);
  const [confirmarEliminar, setConfirmarEliminar] = useState(null);

  // Autocomplete para cliente en el formulario
  const [busqCliente, setBusqCliente] = useState("");
  const [clientesFiltrados, setClientesFiltrados] = useState([]);
  const [mostrarDropCliente, setMostrarDropCliente] = useState(false);

  useEffect(() => { cargar(); cargarClientes(); }, []);

  async function cargar() {
    if (!agenciaId) return;
    setCargando(true);
    const { data, error } = await supabase
      .from("pasajeros")
      .select("*, clientes(id, tipo, apellido, nombres, razon_social)")
      .eq("agencia_id", agenciaId)
      .order("apellido", { ascending: true });
    setCargando(false);
    if (error) { mostrarFlash("Error al cargar: " + error.message, "error"); return; }
    setPasajeros(data || []);
  }

  async function cargarClientes() {
    if (!agenciaId) return;
    const { data } = await supabase
      .from("clientes")
      .select("id, tipo, apellido, nombres, razon_social")
      .eq("agencia_id", agenciaId)
      .order("apellido", { ascending: true });
    setClientes(data || []);
  }

  function mostrarFlash(texto, tipo) {
    setFlash({ texto, tipo });
    setTimeout(() => setFlash(null), 3500);
  }

  function abrirNuevo() {
    setFicha({ modo: "nuevo", datos: { ...VACIO_PASAJERO }, original: null });
    setBusqCliente("");
  }

  function abrirEditar(p) {
    setFicha({ modo: "editar", datos: { ...p }, original: p });
    const c = p.clientes;
    setBusqCliente(c ? nombreCliente(c) : "");
  }

  function cerrarFicha() {
    setFicha(null);
    setConfirmarEliminar(null);
    setBusqCliente("");
    setMostrarDropCliente(false);
  }

  function setDato(campo, valor) {
    setFicha(f => ({ ...f, datos: { ...f.datos, [campo]: valor } }));
  }

  // Autocomplete cliente
  function onBusqClienteChange(val) {
    setBusqCliente(val);
    if (!val.trim()) {
      setClientesFiltrados([]);
      setMostrarDropCliente(false);
      setDato("cliente_id", null);
      return;
    }
    const q = normalizar(val);
    const filtrados = clientes.filter(c =>
      normalizar(c.apellido).includes(q) ||
      normalizar(c.nombres).includes(q) ||
      normalizar(c.razon_social).includes(q)
    ).slice(0, 6);
    setClientesFiltrados(filtrados);
    setMostrarDropCliente(true);
  }

  function seleccionarCliente(c) {
    setBusqCliente(nombreCliente(c));
    setDato("cliente_id", c.id);
    setMostrarDropCliente(false);
    setClientesFiltrados([]);
  }

  function limpiarCliente() {
    setBusqCliente("");
    setDato("cliente_id", null);
    setMostrarDropCliente(false);
  }

  async function guardar() {
    if (!ficha) return;
    const d = ficha.datos;

    if (!d.apellido?.trim() && !d.nombres?.trim()) {
      mostrarFlash("Ingresá al menos apellido o nombre.", "error");
      return;
    }

    setProcesando(true);
    const payload = {
      agencia_id: agenciaId,
      apellido: d.apellido?.trim() || null,
      nombres: d.nombres?.trim() || null,
      fecha_nacimiento: d.fecha_nacimiento || null,
      genero: d.genero || null,
      nacionalidad: d.nacionalidad?.trim() || null,
      tipo_doc: d.tipo_doc || null,
      nro_documento: d.nro_documento?.trim() || null,
      vencimiento_doc: d.vencimiento_doc || null,
      tiene_pasaporte: !!d.tiene_pasaporte,
      pais_pasaporte: d.tiene_pasaporte ? (d.pais_pasaporte?.trim() || null) : null,
      nro_pasaporte: d.tiene_pasaporte ? (d.nro_pasaporte?.trim() || null) : null,
      vencimiento_pasaporte: d.tiene_pasaporte ? (d.vencimiento_pasaporte || null) : null,
      email: d.email?.trim() || null,
      telefono: d.telefono?.trim() || null,
      cliente_id: d.cliente_id || null,
      observaciones: d.observaciones?.trim() || null,
    };

    let error;
    if (ficha.modo === "nuevo") {
      ({ error } = await supabase.from("pasajeros").insert(payload));
    } else {
      ({ error } = await supabase.from("pasajeros").update(payload).eq("id", ficha.original.id));
    }
    setProcesando(false);
    if (error) { mostrarFlash("Error al guardar: " + error.message, "error"); return; }
    mostrarFlash(ficha.modo === "nuevo" ? "Pasajero creado." : "Pasajero actualizado.", "ok");
    cerrarFicha();
    cargar();
  }

  async function eliminar(p) {
    setProcesando(true);
    const { error } = await supabase.from("pasajeros").delete().eq("id", p.id);
    setProcesando(false);
    setConfirmarEliminar(null);
    cerrarFicha();
    if (error) { mostrarFlash("Error al eliminar: " + error.message, "error"); return; }
    mostrarFlash("Pasajero eliminado.", "ok");
    cargar();
  }

  const filtrados = pasajeros.filter(p => {
    if (!busqueda_str.trim()) return true;
    const q = normalizar(busqueda_str);
    return (
      normalizar(p.apellido).includes(q) ||
      normalizar(p.nombres).includes(q) ||
      normalizar(p.email).includes(q) ||
      (p.nro_documento || "").includes(busqueda_str.trim()) ||
      (p.nro_pasaporte || "").includes(busqueda_str.trim()) ||
      normalizar(p.nacionalidad).includes(q)
    );
  });

  return (
    <div style={{ minHeight: "100vh" }}>
      <header className="topbar">
        <div className="topbar-brand">PRISTINE<span>Pasajeros</span></div>
        <button className="btn-back" onClick={volver}><ArrowLeft size={14} /> Volver</button>
      </header>

      <div style={{ maxWidth: 1080, margin: "0 auto", padding: "44px 24px" }}>
        <div className="page-header">
          <div className="page-eyebrow">Cartera</div>
          <h1 className="page-title">Pasajeros</h1>
        </div>

        <div className="toolbar">
          <div style={{ flex: 1, position: "relative" }}>
            <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text-soft)" }} />
            <input
              className="field-input"
              value={busqueda_str}
              onChange={e => setBusquedaStr(e.target.value)}
              placeholder="Buscar por apellido, nombre, documento, pasaporte, nacionalidad..."
              style={{ paddingLeft: 30 }}
            />
          </div>
          <button className="btn btn-outline" onClick={cargar} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <RefreshCw size={14} /> Actualizar
          </button>
          <button className="btn btn-primary" onClick={abrirNuevo} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Plus size={14} /> Nuevo pasajero
          </button>
        </div>

        {flash && <div className={`flash flash-${flash.tipo}`}>{flash.texto}</div>}

        <div className="table-wrap">
          {cargando ? (
            <div className="empty-state">Cargando...</div>
          ) : filtrados.length === 0 ? (
            <div className="empty-state">{busqueda_str ? "Sin resultados." : "No hay pasajeros registrados."}</div>
          ) : (
            <table>
              <thead>
                <tr>
                  {["Apellido y nombres", "Nacimiento / Edad", "Documento", "Pasaporte", "Cliente", "Contacto", ""].map(h => <th key={h}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {filtrados.map(p => {
                  const edad = edadDesde(p.fecha_nacimiento);
                  const alertaDoc = alertaVencimiento(p.vencimiento_doc);
                  const alertaPasaporte = alertaVencimiento(p.vencimiento_pasaporte);
                  return (
                    <tr key={p.id} style={{ cursor: "pointer" }} onClick={() => abrirEditar(p)}>
                      <td className="td-bold" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <User size={14} style={{ color: "var(--text-soft)", flexShrink: 0 }} />
                        {nombrePasajero(p)}
                      </td>
                      <td className="td-muted">
                        {p.fecha_nacimiento
                          ? <>{new Date(p.fecha_nacimiento).toLocaleDateString("es-AR")} <span style={{ color: "var(--text-soft)", fontSize: ".8em" }}>({edad} años)</span></>
                          : "—"}
                      </td>
                      <td className="td-muted">
                        {p.nro_documento
                          ? <>{p.tipo_doc} {p.nro_documento}<BadgeAlerta estado={alertaDoc} /></>
                          : "—"}
                      </td>
                      <td className="td-muted">
                        {p.tiene_pasaporte && p.nro_pasaporte
                          ? <>{p.pais_pasaporte ? `(${p.pais_pasaporte}) ` : ""}{p.nro_pasaporte}<BadgeAlerta estado={alertaPasaporte} /></>
                          : "—"}
                      </td>
                      <td className="td-muted">{nombreCliente(p.clientes)}</td>
                      <td className="td-muted">{p.telefono || p.email || "—"}</td>
                      <td onClick={e => e.stopPropagation()}>
                        <button className="btn-icon danger" title="Eliminar" onClick={() => { abrirEditar(p); setConfirmarEliminar(p); }}>
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
        <p style={{ marginTop: 12, fontSize: ".75rem", color: "var(--text-soft)" }}>
          {filtrados.length} pasajero{filtrados.length !== 1 ? "s" : ""}
        </p>
      </div>

      {/* ============ MODAL FICHA ============ */}
      {ficha && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) cerrarFicha(); }}>
          <div className="modal" style={{ maxWidth: 660, width: "100%", maxHeight: "90vh", overflowY: "auto" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
              <div className="modal-title" style={{ margin: 0 }}>
                {ficha.modo === "nuevo" ? "Nuevo pasajero" : "Editar pasajero"}
              </div>
              <button className="btn-icon" onClick={cerrarFicha}><X size={16} /></button>
            </div>

            <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>

              {/* Datos personales */}
              <div style={{ flex: "1 1 100%", fontSize: ".75rem", fontWeight: 800, color: "var(--text-soft)", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: -4 }}>
                Datos personales
              </div>

              <Field label="Apellido" half>
                <Input value={ficha.datos.apellido} onChange={e => setDato("apellido", e.target.value)} placeholder="Apellido" />
              </Field>
              <Field label="Nombres" half>
                <Input value={ficha.datos.nombres} onChange={e => setDato("nombres", e.target.value)} placeholder="Nombres" />
              </Field>
              <Field label="Fecha de nacimiento" third>
                <Input type="date" value={ficha.datos.fecha_nacimiento} onChange={e => setDato("fecha_nacimiento", e.target.value)} />
              </Field>
              <Field label="Género" third>
                <Select value={ficha.datos.genero} onChange={e => setDato("genero", e.target.value)} options={GENEROS} />
              </Field>
              <Field label="Nacionalidad" third>
                <Input value={ficha.datos.nacionalidad} onChange={e => setDato("nacionalidad", e.target.value)} placeholder="Argentina, Italiana..." />
              </Field>

              {/* Documento */}
              <div style={{ flex: "1 1 100%", fontSize: ".75rem", fontWeight: 800, color: "var(--text-soft)", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: -4, marginTop: 4 }}>
                Documento
              </div>

              <Field label="Tipo" third>
                <Select value={ficha.datos.tipo_doc} onChange={e => setDato("tipo_doc", e.target.value)} options={TIPOS_DOC} />
              </Field>
              <Field label="Número" third>
                <Input value={ficha.datos.nro_documento} onChange={e => setDato("nro_documento", e.target.value)} placeholder="30123456" />
              </Field>
              <Field label="Vencimiento" third>
                <Input type="date" value={ficha.datos.vencimiento_doc} onChange={e => setDato("vencimiento_doc", e.target.value)} />
              </Field>
              {ficha.datos.vencimiento_doc && alertaVencimiento(ficha.datos.vencimiento_doc) && (
                <div style={{ flex: "1 1 100%", fontSize: ".78rem", color: alertaVencimiento(ficha.datos.vencimiento_doc) === "vencido" ? "#dc2626" : "#d97706", fontWeight: 600 }}>
                  ⚠ Documento {alertaVencimiento(ficha.datos.vencimiento_doc) === "vencido" ? "vencido" : "vence en menos de 6 meses"}
                </div>
              )}

              {/* Pasaporte */}
              <div style={{ flex: "1 1 100%", marginTop: 4 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: ".85rem", fontWeight: 600 }}>
                  <input
                    type="checkbox"
                    checked={!!ficha.datos.tiene_pasaporte}
                    onChange={e => setDato("tiene_pasaporte", e.target.checked)}
                    style={{ width: 16, height: 16 }}
                  />
                  Tiene pasaporte
                </label>
              </div>

              {ficha.datos.tiene_pasaporte && (
                <>
                  <Field label="País emisor del pasaporte" third>
                    <Input value={ficha.datos.pais_pasaporte} onChange={e => setDato("pais_pasaporte", e.target.value)} placeholder="Argentina, Italia..." />
                  </Field>
                  <Field label="Número de pasaporte" third>
                    <Input value={ficha.datos.nro_pasaporte} onChange={e => setDato("nro_pasaporte", e.target.value)} placeholder="AAA123456" />
                  </Field>
                  <Field label="Vencimiento del pasaporte" third>
                    <Input type="date" value={ficha.datos.vencimiento_pasaporte} onChange={e => setDato("vencimiento_pasaporte", e.target.value)} />
                  </Field>
                  {ficha.datos.vencimiento_pasaporte && alertaVencimiento(ficha.datos.vencimiento_pasaporte) && (
                    <div style={{ flex: "1 1 100%", fontSize: ".78rem", color: alertaVencimiento(ficha.datos.vencimiento_pasaporte) === "vencido" ? "#dc2626" : "#d97706", fontWeight: 600 }}>
                      ⚠ Pasaporte {alertaVencimiento(ficha.datos.vencimiento_pasaporte) === "vencido" ? "vencido" : "vence en menos de 6 meses"}
                    </div>
                  )}
                </>
              )}

              {/* Contacto */}
              <div style={{ flex: "1 1 100%", fontSize: ".75rem", fontWeight: 800, color: "var(--text-soft)", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: -4, marginTop: 4 }}>
                Contacto
              </div>
              <Field label="Email" half>
                <Input type="email" value={ficha.datos.email} onChange={e => setDato("email", e.target.value)} placeholder="correo@ejemplo.com" />
              </Field>
              <Field label="Teléfono" half>
                <Input value={ficha.datos.telefono} onChange={e => setDato("telefono", e.target.value)} placeholder="5491156781234" />
              </Field>

              {/* Cliente vinculado */}
              <div style={{ flex: "1 1 100%", fontSize: ".75rem", fontWeight: 800, color: "var(--text-soft)", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: -4, marginTop: 4 }}>
                Cliente asociado (opcional)
              </div>
              <Field label="Buscar cliente">
                <div style={{ position: "relative" }}>
                  <input
                    className="field-input"
                    value={busqCliente}
                    onChange={e => onBusqClienteChange(e.target.value)}
                    onFocus={() => busqCliente && setMostrarDropCliente(true)}
                    placeholder="Escribí el nombre del cliente..."
                  />
                  {ficha.datos.cliente_id && (
                    <button
                      onClick={limpiarCliente}
                      style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "var(--text-soft)" }}
                    >
                      <X size={14} />
                    </button>
                  )}
                  {mostrarDropCliente && clientesFiltrados.length > 0 && (
                    <div style={{
                      position: "absolute", top: "100%", left: 0, right: 0, zIndex: 100,
                      background: "#fff", border: "1px solid var(--border, #e2e4ef)",
                      borderRadius: 8, boxShadow: "0 4px 16px rgba(0,0,0,.1)", overflow: "hidden",
                    }}>
                      {clientesFiltrados.map(c => (
                        <div
                          key={c.id}
                          onClick={() => seleccionarCliente(c)}
                          style={{ padding: "8px 14px", cursor: "pointer", fontSize: ".85rem" }}
                          onMouseEnter={e => e.currentTarget.style.background = "var(--bg-soft, #f4f5f8)"}
                          onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                        >
                          {nombreCliente(c)}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </Field>

              {/* Observaciones */}
              <Field label="Observaciones">
                <textarea
                  className="field-input"
                  value={ficha.datos.observaciones || ""}
                  onChange={e => setDato("observaciones", e.target.value)}
                  placeholder="Notas internas sobre este pasajero..."
                  rows={3}
                  style={{ resize: "vertical" }}
                />
              </Field>
            </div>

            <div className="modal-actions">
              {ficha.modo === "editar" && (
                <button className="btn btn-danger" onClick={() => setConfirmarEliminar(ficha.original)} disabled={procesando}>
                  Eliminar
                </button>
              )}
              <div style={{ flex: 1 }} />
              <button className="btn btn-outline" onClick={cerrarFicha} disabled={procesando}>Cancelar</button>
              <button className="btn btn-primary" onClick={guardar} disabled={procesando}>
                {procesando ? "Guardando..." : ficha.modo === "nuevo" ? "Crear pasajero" : "Guardar cambios"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============ CONFIRMAR ELIMINAR ============ */}
      {confirmarEliminar && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-title">¿Eliminar pasajero?</div>
            <p className="modal-body">
              <strong>{nombrePasajero(confirmarEliminar)}</strong> se eliminará permanentemente.
            </p>
            <div className="modal-actions">
              <button className="btn btn-outline" onClick={() => setConfirmarEliminar(null)} disabled={procesando}>Cancelar</button>
              <button className="btn btn-danger" onClick={() => eliminar(confirmarEliminar)} disabled={procesando}>
                {procesando ? "Eliminando..." : "Eliminar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

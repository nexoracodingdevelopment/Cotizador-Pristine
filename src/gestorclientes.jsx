import { useEffect, useState, useRef } from "react";
import { ArrowLeft, Plus, Trash2, RefreshCw, Search, X, ChevronDown, ChevronUp, User, Building2 } from "lucide-react";
import { supabase } from "./supabase";

const CONDICIONES_IVA = [
  "Responsable Inscripto",
  "Monotributista",
  "Exento",
  "Consumidor Final",
  "No Responsable",
];

const VACIO_CLIENTE = {
  tipo: "persona_fisica",
  razon_social: "",
  apellido: "",
  nombres: "",
  cuit_cuil: "",
  condicion_iva: "Consumidor Final",
  email: "",
  telefono: "",
  direccion: "",
  localidad: "",
  codigo_postal: "",
  pais: "Argentina",
  observaciones: "",
};

function normalizar(s) {
  return (s || "").toUpperCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
}

function nombreMostrado(c) {
  if (c.tipo === "persona_juridica") return c.razon_social || "(sin nombre)";
  const partes = [c.apellido, c.nombres].filter(Boolean);
  return partes.length ? partes.join(", ") : "(sin nombre)";
}

function Field({ label, children, half }) {
  return (
    <div style={{ flex: half ? "1 1 calc(50% - 8px)" : "1 1 100%", minWidth: 0 }}>
      <label style={{ display: "block", fontSize: ".72rem", fontWeight: 700, color: "var(--text-soft)", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 4 }}>
        {label}
      </label>
      {children}
    </div>
  );
}

function Input({ value, onChange, placeholder, type = "text", readOnly }) {
  return (
    <input
      className="field-input"
      type={type}
      value={value || ""}
      onChange={onChange}
      placeholder={placeholder}
      readOnly={readOnly}
      style={readOnly ? { background: "var(--bg-soft, #f4f5f8)", color: "var(--text-soft)" } : {}}
    />
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

export default function GestorClientes({ volver, usuario }) {
  const agenciaId = usuario?.agencia_id;

  const [clientes, setClientes] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [flash, setFlash] = useState(null);
  const [procesando, setProcesando] = useState(false);

  // Modal ficha
  const [ficha, setFicha] = useState(null); // null | { modo: "nuevo"|"editar", datos: {...}, original: {...}|null }
  const [confirmarEliminar, setConfirmarEliminar] = useState(null);

  // Pasajeros del cliente seleccionado (panel expandible en ficha)
  const [pasajerosCliente, setPasajerosCliente] = useState([]);
  const [cargandoPasajeros, setCargandoPasajeros] = useState(false);
  const [mostrarPasajeros, setMostrarPasajeros] = useState(false);

  useEffect(() => { cargar(); }, []);

  async function cargar() {
    if (!agenciaId) return;
    setCargando(true);
    const { data, error } = await supabase
      .from("clientes")
      .select("*")
      .eq("agencia_id", agenciaId)
      .order("apellido", { ascending: true });
    setCargando(false);
    if (error) { mostrarFlash("Error al cargar: " + error.message, "error"); return; }
    setClientes(data || []);
  }

  async function cargarPasajerosDeCliente(clienteId) {
    setCargandoPasajeros(true);
    const { data, error } = await supabase
      .from("pasajeros")
      .select("id, apellido, nombres, tipo_doc, nro_documento, telefono, email")
      .eq("agencia_id", agenciaId)
      .eq("cliente_id", clienteId)
      .order("apellido", { ascending: true });
    setCargandoPasajeros(false);
    if (!error) setPasajerosCliente(data || []);
  }

  function mostrarFlash(texto, tipo) {
    setFlash({ texto, tipo });
    setTimeout(() => setFlash(null), 3500);
  }

  function abrirNuevo() {
    setFicha({ modo: "nuevo", datos: { ...VACIO_CLIENTE }, original: null });
    setMostrarPasajeros(false);
    setPasajerosCliente([]);
  }

  function abrirEditar(c) {
    setFicha({ modo: "editar", datos: { ...c }, original: c });
    setMostrarPasajeros(false);
    setPasajerosCliente([]);
  }

  function cerrarFicha() {
    setFicha(null);
    setConfirmarEliminar(null);
    setPasajerosCliente([]);
    setMostrarPasajeros(false);
  }

  function setDato(campo, valor) {
    setFicha(f => ({ ...f, datos: { ...f.datos, [campo]: valor } }));
  }

  async function guardar() {
    if (!ficha) return;
    const d = ficha.datos;

    // Validación mínima
    const nombreValido = d.tipo === "persona_juridica" ? d.razon_social?.trim() : (d.apellido?.trim() || d.nombres?.trim());
    if (!nombreValido) {
      mostrarFlash("Ingresá al menos un nombre o razón social.", "error");
      return;
    }

    setProcesando(true);
    const payload = {
      ...d,
      agencia_id: agenciaId,
      // normalizar para búsqueda
      apellido: d.apellido?.trim() || null,
      nombres: d.nombres?.trim() || null,
      razon_social: d.razon_social?.trim() || null,
    };
    delete payload.id;
    delete payload.creado_en;
    delete payload.actualizado_en;

    let error;
    if (ficha.modo === "nuevo") {
      ({ error } = await supabase.from("clientes").insert(payload));
    } else {
      ({ error } = await supabase.from("clientes").update(payload).eq("id", ficha.original.id));
    }
    setProcesando(false);
    if (error) { mostrarFlash("Error al guardar: " + error.message, "error"); return; }
    mostrarFlash(ficha.modo === "nuevo" ? "Cliente creado." : "Cliente actualizado.", "ok");
    cerrarFicha();
    cargar();
  }

  async function eliminar(c) {
    setProcesando(true);
    const { error } = await supabase.from("clientes").delete().eq("id", c.id);
    setProcesando(false);
    setConfirmarEliminar(null);
    cerrarFicha();
    if (error) { mostrarFlash("Error al eliminar: " + error.message, "error"); return; }
    mostrarFlash("Cliente eliminado.", "ok");
    cargar();
  }

  // Filtrado local con normalización
  const filtrados = clientes.filter(c => {
    if (!busqueda.trim()) return true;
    const q = normalizar(busqueda);
    return (
      normalizar(c.apellido).includes(q) ||
      normalizar(c.nombres).includes(q) ||
      normalizar(c.razon_social).includes(q) ||
      normalizar(c.email).includes(q) ||
      (c.cuit_cuil || "").includes(busqueda.trim()) ||
      normalizar(c.localidad).includes(q)
    );
  });

  return (
    <div style={{ minHeight: "100vh" }}>
      <header className="topbar">
        <div className="topbar-brand">PRISTINE<span>Clientes</span></div>
        <button className="btn-back" onClick={volver}><ArrowLeft size={14} /> Volver</button>
      </header>

      <div style={{ maxWidth: 1080, margin: "0 auto", padding: "44px 24px" }}>
        <div className="page-header">
          <div className="page-eyebrow">Cartera</div>
          <h1 className="page-title">Clientes</h1>
        </div>

        <div className="toolbar">
          <div style={{ flex: 1, position: "relative" }}>
            <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text-soft)" }} />
            <input
              className="field-input"
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              placeholder="Buscar por nombre, email, CUIT/CUIL, localidad..."
              style={{ paddingLeft: 30 }}
            />
          </div>
          <button className="btn btn-outline" onClick={cargar} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <RefreshCw size={14} /> Actualizar
          </button>
          <button className="btn btn-primary" onClick={abrirNuevo} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Plus size={14} /> Nuevo cliente
          </button>
        </div>

        {flash && <div className={`flash flash-${flash.tipo}`}>{flash.texto}</div>}

        <div className="table-wrap">
          {cargando ? (
            <div className="empty-state">Cargando...</div>
          ) : filtrados.length === 0 ? (
            <div className="empty-state">{busqueda ? "Sin resultados." : "No hay clientes registrados."}</div>
          ) : (
            <table>
              <thead>
                <tr>
                  {["Nombre / Razón social", "Tipo", "CUIT/CUIL", "Email", "Teléfono", "Localidad", ""].map(h => <th key={h}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {filtrados.map(c => (
                  <tr key={c.id} style={{ cursor: "pointer" }} onClick={() => abrirEditar(c)}>
                    <td className="td-bold" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      {c.tipo === "persona_juridica"
                        ? <Building2 size={14} style={{ color: "var(--text-soft)", flexShrink: 0 }} />
                        : <User size={14} style={{ color: "var(--text-soft)", flexShrink: 0 }} />}
                      {nombreMostrado(c)}
                    </td>
                    <td className="td-muted">{c.tipo === "persona_juridica" ? "Jurídica" : "Física"}</td>
                    <td className="td-muted">{c.cuit_cuil || "—"}</td>
                    <td className="td-muted">{c.email || "—"}</td>
                    <td className="td-muted">{c.telefono || "—"}</td>
                    <td className="td-muted">{c.localidad || "—"}</td>
                    <td onClick={e => e.stopPropagation()}>
                      <button className="btn-icon danger" title="Eliminar" onClick={() => { abrirEditar(c); setConfirmarEliminar(c); }}>
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <p style={{ marginTop: 12, fontSize: ".75rem", color: "var(--text-soft)" }}>
          {filtrados.length} cliente{filtrados.length !== 1 ? "s" : ""}
        </p>
      </div>

      {/* ============ MODAL FICHA ============ */}
      {ficha && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) cerrarFicha(); }}>
          <div className="modal" style={{ maxWidth: 640, width: "100%", maxHeight: "90vh", overflowY: "auto" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
              <div className="modal-title" style={{ margin: 0 }}>
                {ficha.modo === "nuevo" ? "Nuevo cliente" : "Editar cliente"}
              </div>
              <button className="btn-icon" onClick={cerrarFicha}><X size={16} /></button>
            </div>

            {/* Tipo */}
            <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
              {[["persona_fisica", "Persona física", User], ["persona_juridica", "Persona jurídica", Building2]].map(([val, label, Icon]) => (
                <button
                  key={val}
                  onClick={() => setDato("tipo", val)}
                  style={{
                    flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                    padding: "8px 0", borderRadius: 8, border: "2px solid",
                    borderColor: ficha.datos.tipo === val ? "var(--accent, #1B2E8A)" : "var(--border, #e2e4ef)",
                    background: ficha.datos.tipo === val ? "var(--accent-light, #eef1fc)" : "transparent",
                    color: ficha.datos.tipo === val ? "var(--accent, #1B2E8A)" : "var(--text-soft)",
                    fontWeight: 600, fontSize: ".85rem", cursor: "pointer",
                  }}
                >
                  <Icon size={14} /> {label}
                </button>
              ))}
            </div>

            <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
              {ficha.datos.tipo === "persona_juridica" ? (
                <Field label="Razón social">
                  <Input value={ficha.datos.razon_social} onChange={e => setDato("razon_social", e.target.value)} placeholder="Nombre de la empresa" />
                </Field>
              ) : (
                <>
                  <Field label="Apellido" half>
                    <Input value={ficha.datos.apellido} onChange={e => setDato("apellido", e.target.value)} placeholder="Apellido" />
                  </Field>
                  <Field label="Nombres" half>
                    <Input value={ficha.datos.nombres} onChange={e => setDato("nombres", e.target.value)} placeholder="Nombres" />
                  </Field>
                </>
              )}

              <Field label="CUIT / CUIL" half>
                <Input value={ficha.datos.cuit_cuil} onChange={e => setDato("cuit_cuil", e.target.value)} placeholder="20-12345678-9" />
              </Field>
              <Field label="Condición frente al IVA" half>
                <Select value={ficha.datos.condicion_iva} onChange={e => setDato("condicion_iva", e.target.value)} options={CONDICIONES_IVA} />
              </Field>

              <Field label="Email" half>
                <Input type="email" value={ficha.datos.email} onChange={e => setDato("email", e.target.value)} placeholder="correo@ejemplo.com" />
              </Field>
              <Field label="Teléfono" half>
                <Input value={ficha.datos.telefono} onChange={e => setDato("telefono", e.target.value)} placeholder="5491156781234" />
              </Field>

              <Field label="Dirección">
                <Input value={ficha.datos.direccion} onChange={e => setDato("direccion", e.target.value)} placeholder="Calle y número" />
              </Field>
              <Field label="Localidad" half>
                <Input value={ficha.datos.localidad} onChange={e => setDato("localidad", e.target.value)} placeholder="Ciudad / Localidad" />
              </Field>
              <Field label="Código postal" half>
                <Input value={ficha.datos.codigo_postal} onChange={e => setDato("codigo_postal", e.target.value)} placeholder="1234" />
              </Field>
              <Field label="País" half>
                <Input value={ficha.datos.pais} onChange={e => setDato("pais", e.target.value)} placeholder="Argentina" />
              </Field>

              <Field label="Observaciones">
                <textarea
                  className="field-input"
                  value={ficha.datos.observaciones || ""}
                  onChange={e => setDato("observaciones", e.target.value)}
                  placeholder="Notas internas sobre este cliente..."
                  rows={3}
                  style={{ resize: "vertical" }}
                />
              </Field>
            </div>

            {/* Pasajeros vinculados (solo en modo editar) */}
            {ficha.modo === "editar" && (
              <div style={{ borderTop: "1px solid var(--border, #e2e4ef)", paddingTop: 14, marginBottom: 16 }}>
                <button
                  style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", cursor: "pointer", color: "var(--text-soft)", fontSize: ".85rem", fontWeight: 600, padding: 0 }}
                  onClick={() => {
                    const siguiente = !mostrarPasajeros;
                    setMostrarPasajeros(siguiente);
                    if (siguiente && pasajerosCliente.length === 0) cargarPasajerosDeCliente(ficha.original.id);
                  }}
                >
                  {mostrarPasajeros ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  Pasajeros vinculados
                </button>
                {mostrarPasajeros && (
                  <div style={{ marginTop: 10 }}>
                    {cargandoPasajeros ? (
                      <p style={{ fontSize: ".8rem", color: "var(--text-soft)" }}>Cargando...</p>
                    ) : pasajerosCliente.length === 0 ? (
                      <p style={{ fontSize: ".8rem", color: "var(--text-soft)" }}>Sin pasajeros vinculados a este cliente.</p>
                    ) : (
                      <table style={{ width: "100%", fontSize: ".82rem" }}>
                        <thead>
                          <tr>{["Apellido y nombres", "Doc", "Nro documento", "Teléfono"].map(h => <th key={h} style={{ textAlign: "left", padding: "4px 8px", color: "var(--text-soft)", fontWeight: 600 }}>{h}</th>)}</tr>
                        </thead>
                        <tbody>
                          {pasajerosCliente.map(p => (
                            <tr key={p.id}>
                              <td style={{ padding: "4px 8px" }}>{p.apellido}, {p.nombres}</td>
                              <td style={{ padding: "4px 8px", color: "var(--text-soft)" }}>{p.tipo_doc || "—"}</td>
                              <td style={{ padding: "4px 8px", color: "var(--text-soft)" }}>{p.nro_documento || "—"}</td>
                              <td style={{ padding: "4px 8px", color: "var(--text-soft)" }}>{p.telefono || "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="modal-actions">
              {ficha.modo === "editar" && (
                <button className="btn btn-danger" onClick={() => setConfirmarEliminar(ficha.original)} disabled={procesando}>
                  Eliminar
                </button>
              )}
              <div style={{ flex: 1 }} />
              <button className="btn btn-outline" onClick={cerrarFicha} disabled={procesando}>Cancelar</button>
              <button className="btn btn-primary" onClick={guardar} disabled={procesando}>
                {procesando ? "Guardando..." : ficha.modo === "nuevo" ? "Crear cliente" : "Guardar cambios"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============ CONFIRMAR ELIMINAR ============ */}
      {confirmarEliminar && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-title">¿Eliminar cliente?</div>
            <p className="modal-body">
              <strong>{nombreMostrado(confirmarEliminar)}</strong> se eliminará permanentemente. Los pasajeros vinculados quedarán sin cliente asignado.
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

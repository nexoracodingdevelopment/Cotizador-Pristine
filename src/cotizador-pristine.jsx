import React, { useState, useEffect, useMemo, useRef } from "react";
import { Plus, Trash2, Compass, ChevronDown, ChevronUp, Settings2, Users, Layers, Receipt, RotateCcw, Copy } from "lucide-react";
import { supabase } from "./supabase";

const CATEGORIAS = [
  { id: "aereo", label: "Aéreo", template: "Aéreos [origen] / [destino] / [origen] con [equipaje]" },
  { id: "traslado", label: "Traslado", template: "Traslados aeropuerto / hotel / aeropuerto en servicio [tipoServicio]" },
  { id: "hotel", label: "Hotel / Alojamiento", template: "" },
  { id: "auto", label: "Alquiler de auto", template: "Alquiler de auto [categoría] por [días] días" },
  { id: "asistencia", label: "Asistencia al viajero", template: "Asistencia al viajero - cobertura [nivel]" },
  { id: "excursion", label: "Excursión / Tour", template: "Excursión [nombre] de [duración]" },
  { id: "crucero", label: "Crucero", template: "Crucero [naviera], cabina [cabina], itinerario [detalle], [noches] noches" },
  { id: "seguro", label: "Seguro de cancelación", template: "Seguro de cancelación de viaje" },
  { id: "todoincluido", label: "Paquete todo incluido", template: "Paquete todo incluido en [destino] - habitación [tipo] con [plan de comidas]" },
  { id: "entrada", label: "Entrada a parque / atracción", template: "Entrada a [nombre del parque o atracción]" },
  { id: "tren", label: "Tren", template: "Tren [origen] / [destino]" },
  { id: "ferry", label: "Ferry", template: "Ferry [origen] / [destino]" },
  { id: "guia", label: "Guía / Acompañante", template: "Servicio de guía / acompañante en [destino]" },
  { id: "wifi", label: "WiFi / Conectividad", template: "WiFi / chip de conectividad para el viaje" },
  { id: "equipaje", label: "Equipaje adicional", template: "Equipaje adicional [cantidad] x [peso] kg" },
  { id: "checkout", label: "Late check-out / Early check-in", template: "Late check-out / early check-in en el hotel" },
  { id: "evento", label: "Evento especial", template: "Detalle especial por [motivo: luna de miel / cumpleaños / aniversario]" },
  { id: "vip", label: "Traslado VIP / Limusina", template: "Traslado en servicio VIP / limusina" },
  { id: "fasttrack", label: "Check-in prioritario / Fast track", template: "Check-in prioritario / fast track en aeropuerto" },
  { id: "personalizado", label: "Servicio personalizado", template: "" },
];

const TIPOS_HABITACION = ["Individual", "Doble", "Triple", "Cuádruple", "Suite", "Departamento"];
const REGIMENES = ["Sin desayuno", "Con desayuno", "Media pensión", "Pensión completa", "All inclusive"];
const TIPOS_SERVICIO_TRASLADO = ["Regular", "Privado"];
const TIPOS_VUELO = ["Non Stop", "Conexión", "Escala"];
const CATEGORIAS_AUTO = ["Económico", "Intermedio", "SUV", "Premium"];
const SEGUROS_AUTO = ["Básico", "Cobertura total"];
const TIPOS_CABINA = ["Interior", "Exterior", "Balcón", "Suite"];
const NIVELES_COBERTURA = ["Básica", "Superior", "Alto riesgo / deportes"];

const MONEDAS = {
  USD: { label: "Dólares (USD)", prefix: "USD" },
  EUR: { label: "Euros (EUR)", prefix: "EUR" },
  ARS: { label: "Pesos (ARS)", prefix: "$" },
};

const DEFAULT_OPERADORES = [
  { id: "op_generico", nombre: "Operador genérico", gastoOperador: 0, gastoReserva: 0, feeEmision: 0, pctComision: 0 },
];

// Vendedor inicial de una agencia nueva: sale del usuario logueado (no hay vendedores fijos).
function vendedoresPorDefecto(usuario) {
  const nombre = ((usuario && (usuario.contacto || usuario.usuario || usuario.empresa)) || "Vendedor").trim();
  const letra = (nombre.charAt(0) || "V").toUpperCase();
  return [{ nombre, letra }];
}

const DATOS_AGENCIA_VACIOS = { nombre: "", direccion: "", telefono: "", email: "", web: "", eslogan: "", leyenda: "" };

function fmt(n) {
  const v = Number.isFinite(n) ? n : 0;
  return v.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtMoneda(n, moneda) {
  const m = MONEDAS[moneda] || MONEDAS.USD;
  return `${m.prefix} ${fmt(n)}`;
}

function uid(prefix) {
  return prefix + "_" + Date.now() + "_" + Math.floor(Math.random() * 10000);
}

const CATEGORIAS_POR_PERSONA = ["aereo", "hotel", "todoincluido", "asistencia", "excursion", "crucero", "seguro", "entrada", "tren", "ferry", "guia"];

function defaultValorPorPersona(catId) {
  return CATEGORIAS_POR_PERSONA.includes(catId);
}


function buildDescripcion(item) {
  const cat = CATEGORIAS.find((c) => c.id === item.categoria);
  if (!cat || !cat.template) return item.descripcion || "";
  let text = cat.template;
  if (item.categoria === "aereo") {
    const partes = [];
    if (item.incluyeMochila) partes.push("mochila");
    if (item.incluyeCarryOn) partes.push("carry on");
    if (item.incluyeBodega) partes.push("equipaje de bodega");
    const eq = partes.length ? partes.join(" + ") : "sin equipaje declarado";
    text = text.replace("[equipaje]", eq);
  }
  if (item.categoria === "traslado") {
    text = text.replace("[tipoServicio]", (item.tipoServicio || "regular").toLowerCase());
  }
  if (item.categoria === "hotel" || item.categoria === "todoincluido") {
    if (item.noches) text = text.replace("[noches]", String(item.noches));
    if (item.tipoHabitacion) text = text.replace("[tipo]", item.tipoHabitacion.toLowerCase());
    if (item.regimen) text = text.replace("[plan de comidas]", item.regimen.toLowerCase());
  }
  if (item.categoria === "auto") {
    if (item.categoriaAuto) text = text.replace("[categoría]", item.categoriaAuto.toLowerCase());
    if (item.seguroAuto) text += ` · seguro ${item.seguroAuto.toLowerCase()}`;
  }
  if (item.categoria === "crucero") {
    if (item.tipoCabina) text = text.replace("[cabina]", item.tipoCabina.toLowerCase());
    if (item.noches) text = text.replace("[noches]", String(item.noches));
  }
  if (item.categoria === "asistencia") {
    if (item.nivelCobertura) text = text.replace("[nivel]", item.nivelCobertura.toLowerCase());
  }
  return text;
}

function cantidadBoletosItem(item, paxFallback) {
  if (item.tarifasMixtas && Array.isArray(item.tramos) && item.tramos.length) {
    return item.tramos.reduce((s, t) => s + (parseFloat(t.cantidad) || 0), 0);
  }
  return parseFloat(paxFallback) || 0;
}

function calcItem(item, paxMultiplicador) {
  let bruto;
  if (item.tarifasMixtas && Array.isArray(item.tramos) && item.tramos.length) {
    bruto = item.tramos.reduce((s, t) => s + (parseFloat(t.cantidad) || 0) * (parseFloat(t.valor) || 0), 0);
  } else {
    const valorBase = parseFloat(item.bruto) || 0;
    bruto = item.valorPorPersona ? valorBase * (parseFloat(paxMultiplicador) || 0) : valorBase;
  }
  const impuestosFijos = parseFloat(item.impuestosFijos) || 0;
  const brutoTotal = bruto + impuestosFijos; // lo que paga el pasajero
  const pctComision = parseFloat(item.pctComision) || 0;
  const comision = (bruto * pctComision) / 100; // comisión solo sobre comisionable, no sobre impuestos
  const neto = brutoTotal - comision;
  const paxN = parseFloat(paxMultiplicador) || 0;
  const fee = item.aplicaFeeEmision ? (parseFloat(item.feeEmision) || 0) * (item.valorPorPersona ? paxN : 1) : 0;
  const base = neto + fee;
  const pctGastoOperador = parseFloat(item.pctGastoOperador) || 0;
  const gastoOperadorCalculado = (base * pctGastoOperador) / 100;
  // Si hay monto manual, usa ese; si no, usa el calculado por %
  const gastoOperador = item.gastoOperadorManual !== "" && item.gastoOperadorManual !== undefined && item.gastoOperadorManual !== null
    ? parseFloat(item.gastoOperadorManual) || 0
    : gastoOperadorCalculado;
  return { bruto: brutoTotal, brutoComisionable: bruto, impuestosFijos, comision, neto, fee, pctGastoOperador, gastoOperador, gastoOperadorCalculado };
}

function computeGroup(groupItems, operadores, feePristineInput, paxCount) {
  const pax = parseFloat(paxCount) || 1;
  const calcs = groupItems.map((it) => calcItem(it, pax));
  const totalBruto = calcs.reduce((s, c) => s + c.bruto, 0);
  const totalComision = calcs.reduce((s, c) => s + c.comision, 0);
  const totalNeto = calcs.reduce((s, c) => s + c.neto, 0);
  const totalGastoOperadorPct = calcs.reduce((s, c) => s + c.gastoOperador, 0);

  const fee = (parseFloat(feePristineInput) || 0) * pax;
  const gananciaComisionable = totalComision + fee;
  const gastosPristine = gananciaComisionable * 0.42;

  // Gasto de reserva: una vez por operador presente en el grupo
  const operadoresEnGrupo = new Set(groupItems.filter((it) => it.operadorId).map((it) => it.operadorId));
  let totalGastoReserva = 0;
  operadoresEnGrupo.forEach((opId) => {
    const op = operadores.find((o) => o.id === opId);
    if (op) totalGastoReserva += parseFloat(op.gastoReserva) || 0;
  });

  // Fee de emisión: por ítem marcado, multiplicado por la cantidad real de boletos de ese ítem
  let totalFeeEmision = 0;
  groupItems.forEach((it) => {
    if (it.aplicaFeeEmision) {
      totalFeeEmision += (parseFloat(it.feeEmision) || 0) * cantidadBoletosItem(it, pax);
    }
  });

  const totalGastosOperadorBloque = totalGastoOperadorPct + totalGastoReserva + totalFeeEmision;
  const subtotal = totalBruto + fee + gastosPristine + totalGastosOperadorBloque;
  const gastosBancarios = subtotal * 0.012;
  const totalFinal = subtotal + gastosBancarios;
  const totalPorPasajero = totalFinal / pax;

  return {
    totalBruto,
    totalComision,
    totalNeto,
    totalGastoOperadorPct,
    totalGastoReserva,
    totalFeeEmision,
    fee,
    gananciaComisionable,
    gastosPristine,
    subtotal,
    gastosBancarios,
    totalFinal,
    totalPorPasajero,
  };
}

function computeFamiliaShare(groupItems, familia, familiasRegistradas, operadores, feePristineInput) {
  const paxFamilia = parseFloat(familia.pax) || 0;
  const paxTotal = familiasRegistradas.reduce((s, f) => s + (parseFloat(f.pax) || 0), 0) || 1;
  const share = paxTotal > 0 ? paxFamilia / paxTotal : 0;

  const compartidos = groupItems.filter((it) => !it.familiaId);
  const propios = groupItems.filter((it) => it.familiaId === familia.id);

  const calcsCompartidos = compartidos.map((it) => calcItem(it, paxTotal));
  const calcsPropios = propios.map((it) => calcItem(it, paxFamilia));

  const totalBrutoCompartido = calcsCompartidos.reduce((s, c) => s + c.bruto, 0);
  const totalComisionCompartido = calcsCompartidos.reduce((s, c) => s + c.comision, 0);
  const totalGastoOpCompartido = calcsCompartidos.reduce((s, c) => s + c.gastoOperador, 0);

  const totalBrutoPropio = calcsPropios.reduce((s, c) => s + c.bruto, 0);
  const totalComisionPropio = calcsPropios.reduce((s, c) => s + c.comision, 0);
  const totalGastoOpPropio = calcsPropios.reduce((s, c) => s + c.gastoOperador, 0);

  const totalBruto = totalBrutoPropio + totalBrutoCompartido * share;
  const totalComision = totalComisionPropio + totalComisionCompartido * share;
  const totalGastoOperadorPct = totalGastoOpPropio + totalGastoOpCompartido * share;

  const fee = (parseFloat(feePristineInput) || 0) * paxFamilia;
  const gananciaComisionable = totalComision + fee;
  const gastosPristine = gananciaComisionable * 0.42;

  // Gasto de reserva: una sola vez por operador en TODO el grupo (compartidos + todas las familias), prorrateado por pax
  const operadoresEnGrupo = new Set(groupItems.filter((it) => it.operadorId).map((it) => it.operadorId));
  let totalGastoReservaGrupo = 0;
  operadoresEnGrupo.forEach((opId) => {
    const op = operadores.find((o) => o.id === opId);
    if (op) totalGastoReservaGrupo += parseFloat(op.gastoReserva) || 0;
  });
  const totalGastoReserva = totalGastoReservaGrupo * share;

  // Fee de emisión: por ítem marcado, multiplicado por la cantidad real de boletos
  let totalFeeEmision = 0;
  propios.forEach((it) => {
    if (it.aplicaFeeEmision) {
      totalFeeEmision += (parseFloat(it.feeEmision) || 0) * cantidadBoletosItem(it, paxFamilia);
    }
  });
  compartidos.forEach((it) => {
    if (it.aplicaFeeEmision) {
      // compartido con tarifas mixtas: la cantidad de boletos representa a todo el grupo, se prorratea por participación
      // compartido simple: la cantidad de boletos de ESTA familia es directamente su pax
      const cantidadTotal = it.tarifasMixtas ? cantidadBoletosItem(it, paxTotal) : paxFamilia;
      const feeTotal = (parseFloat(it.feeEmision) || 0) * cantidadTotal;
      totalFeeEmision += it.tarifasMixtas ? feeTotal * share : feeTotal;
    }
  });

  const totalGastosOperadorBloque = totalGastoOperadorPct + totalGastoReserva + totalFeeEmision;
  const subtotal = totalBruto + fee + gastosPristine + totalGastosOperadorBloque;
  const gastosBancarios = subtotal * 0.012;
  const totalFinal = subtotal + gastosBancarios;
  const totalPorPasajero = paxFamilia > 0 ? totalFinal / paxFamilia : 0;

  return {
    familiaId: familia.id,
    familiaNombre: familia.nombre || "Familia sin nombre",
    paxFamilia,
    totalBruto,
    totalComision,
    totalGastoOperadorPct,
    totalGastoReserva,
    totalFeeEmision,
    fee,
    gananciaComisionable,
    gastosPristine,
    subtotal,
    gastosBancarios,
    totalFinal,
    totalPorPasajero,
  };
}

function shortLabel(item) {
  const text = (item.descripcion || "").trim();
  const base = text || "(sin nombre)";
  // Para hoteles y todo incluido, agregar tipo de habitación y régimen
  if (item.categoria === "hotel" || item.categoria === "todoincluido") {
    const extras = [item.tipoHabitacion, item.regimen].filter(Boolean);
    if (extras.length) {
      const full = `${base} — ${extras.join(" · ")}`;
      const max = 50;
      return full.length > max ? full.slice(0, max).trim() + "…" : full;
    }
  }
  const max = 28;
  return base.length > max ? base.slice(0, max).trim() + "…" : base;
}

function SinglePillGroup({ value, options, onChange }) {
  return (
    <div className="pill-select-group">
      {options.map((opt) => (
        <span
          key={opt}
          className={"pill-select" + (value === opt ? " active" : "")}
          onClick={() => onChange(value === opt ? "" : opt)}
        >
          {opt}
        </span>
      ))}
    </div>
  );
}

function FilaPago({ pago, monedaCot, onUpdate, onRemove }) {
  const [editingImporte, setEditingImporte] = React.useState(false);
  const monedaBase = monedaCot === "ARS" ? "ARS" : "USD";

  function handleFecha(e) {
    const digits = e.target.value.replace(/\D/g, "").slice(0, 8);
    let f = digits;
    if (digits.length > 4) f = digits.slice(0,2) + "/" + digits.slice(2,4) + "/" + digits.slice(4);
    else if (digits.length > 2) f = digits.slice(0,2) + "/" + digits.slice(2);
    onUpdate("fecha", f);
  }

  function parseImporte(s) {
    if (!s && s !== 0) return 0;
    return parseFloat(String(s).replace(/\./g, "").replace(",", ".")) || 0;
  }

  function fmtImporte(valor, moneda) {
    const n = parseImporte(valor);
    if (!n && n !== 0) return "";
    return `${moneda} ${n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  function calcEquiv() {
    const imp = parseImporte(pago.importe);
    const tc = parseFloat(pago.tipoCambio) || 1;
    if (monedaBase === "USD") {
      if (pago.moneda === "ARS") return imp / tc;
      if (pago.moneda === "EUR") return imp * tc;
    }
    if (monedaBase === "ARS") {
      if (pago.moneda === "USD") return imp * tc;
      if (pago.moneda === "EUR") return imp * tc;
    }
    return imp;
  }

  function fmtN(n) {
    if (isNaN(n) || n === null) return "—";
    return `${monedaBase} ${n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  const equiv = pago.importe && pago.moneda !== monedaBase ? calcEquiv() : null;

  const inputProps = (moneda) => ({
    type: "text",
    value: editingImporte ? pago.importe : (pago.importe ? fmtImporte(pago.importe, moneda) : ""),
    onChange: (e) => onUpdate("importe", e.target.value),
    onFocus: () => setEditingImporte(true),
    onBlur: () => setEditingImporte(false),
    placeholder: `${moneda} 0,00`,
    style: { width: 110, textAlign: "right", fontVariantNumeric: "tabular-nums" },
  });

  return (
    <tr>
      <td><input value={pago.fecha} onChange={handleFecha} placeholder="DD/MM/AAAA" maxLength={10} style={{ width: 100 }} /></td>
      <td>
        <select value={pago.moneda} onChange={(e) => onUpdate("moneda", e.target.value)} style={{ width: 72 }}>
          <option value="USD">USD</option>
          <option value="ARS">ARS</option>
          <option value="EUR">EUR</option>
        </select>
      </td>
      {/* Columna base */}
      <td style={{ textAlign: "right" }}>
        {pago.moneda === monedaBase
          ? <input {...inputProps(monedaBase)} />
          : equiv !== null
            ? <span style={{ color: "var(--navy)", fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{fmtN(equiv)}</span>
            : <span style={{ color: "var(--text-soft)" }}>—</span>
        }
      </td>
      {/* Columna ARS (si base no es ARS) */}
      {monedaBase !== "ARS" && (
        <td style={{ textAlign: "right" }}>
          {pago.moneda === "ARS"
            ? <input {...inputProps("ARS")} />
            : <span style={{ color: "var(--text-soft)" }}>—</span>
          }
        </td>
      )}
      {/* Columna EUR */}
      <td style={{ textAlign: "right" }}>
        {pago.moneda === "EUR"
          ? <input {...inputProps("EUR")} />
          : <span style={{ color: "var(--text-soft)" }}>—</span>
        }
      </td>
      {/* Tipo de cambio */}
      <td>
        {pago.moneda !== monedaBase
          ? <input type="text" value={pago.tipoCambio} onChange={(e) => onUpdate("tipoCambio", e.target.value)} placeholder="TC" style={{ width: 90 }} />
          : <span style={{ color: "var(--text-soft)" }}>—</span>
        }
      </td>
      <td><button className="btn-icon" onClick={onRemove}><Trash2 size={13} /></button></td>
    </tr>
  );
}




function FL({ children, label }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2, flexShrink: 0 }}>
      {children}
      <span style={{ fontSize: 9.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em", color: "var(--text-soft)", whiteSpace: "nowrap" }}>{label}</span>
    </div>
  );
}

function normalizeText(s) {
  return (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function ComboField({ value, options, onSelect, createLabel }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const filtered = options.filter((o) => normalizeText(o).includes(normalizeText(query)));
  const exactMatch = options.some((o) => normalizeText(o) === normalizeText(query));
  const displayValue = open ? query : value || "";

  function selectOption(opt) {
    onSelect(opt);
    setOpen(false);
    setQuery("");
  }

  function createNew() {
    const trimmed = query.trim();
    if (trimmed) onSelect(trimmed);
    setOpen(false);
    setQuery("");
  }

  return (
    <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
      <div style={{ position: "relative", flex: 1 }}>
        <input
          value={displayValue}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onPaste={(e) => {
            const pasted = e.clipboardData ? e.clipboardData.getData("text") : "";
            if (pasted) {
              e.preventDefault();
              setQuery(pasted.trim());
              setOpen(true);
            }
          }}
          onFocus={() => {
            setQuery(value || "");
            setOpen(true);
          }}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder="Compartido"
        />
        {open && (
          <div className="combo-dropdown">
            <div className="combo-option" onMouseDown={(e) => { e.preventDefault(); selectOption(""); }}>
              Compartido
            </div>
            {filtered.map((o) => (
              <div key={o} className="combo-option" onMouseDown={(e) => { e.preventDefault(); selectOption(o); }}>
                {o}
              </div>
            ))}
            {query.trim() && !exactMatch && (
              <div className="combo-option combo-create" onMouseDown={(e) => { e.preventDefault(); createNew(); }}>
                + {createLabel} "{query.trim()}"
              </div>
            )}
          </div>
        )}
      </div>
      {options.length > 0 && (
        <select
          value=""
          onChange={(e) => { if (e.target.value) selectOption(e.target.value); }}
          title="Elegir de los ya usados"
          style={{ width: 30, padding: "7px 2px", textAlign: "center" }}
        >
          <option value="">▾</option>
          {options.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      )}
    </div>
  );
}




// Input de importe con separadores de miles (punto) y decimales (coma) — formato es-AR
function ImporteInput({ value, onChange, placeholder, style, disabled }) {
  const [display, setDisplay] = React.useState("");
  const [focused, setFocused] = React.useState(false);

  React.useEffect(() => {
    if (!focused) {
      const n = parseFloat(String(value).replace(/\./g, "").replace(",", ".")) || parseFloat(value) || 0;
      setDisplay(n === 0 && !value ? "" : n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
    }
  }, [value, focused]);

  function handleFocus(e) {
    setFocused(true);
    // Mostrar valor sin formato para edición
    const n = parseFloat(String(value).replace(/\./g, "").replace(",", ".")) || parseFloat(value) || 0;
    setDisplay(n === 0 ? "" : String(n));
    setTimeout(() => e.target.select(), 0);
  }

  function handleChange(e) {
    // Permitir solo dígitos, coma y punto
    const raw = e.target.value.replace(/[^0-9.,]/g, "");
    setDisplay(raw);
  }

  function handleBlur() {
    setFocused(false);
    // Parsear lo que escribió — acepta tanto punto como coma para decimales
    const raw = display.replace(/\./g, "").replace(",", ".");
    const n = parseFloat(raw) || 0;
    onChange(n === 0 ? "" : String(n));
    setDisplay(n === 0 && !display ? "" : n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
  }

  return (
    <input
      type="text"
      inputMode="decimal"
      value={display}
      placeholder={placeholder || "0"}
      disabled={disabled}
      onChange={handleChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
      style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", ...style }}
    />
  );
}

export default function CotizadorPristine({ usuario, cotizacionInicial, volver }) {
  const [storageReady, setStorageReady] = useState(false);
  const [storageWarning, setStorageWarning] = useState(false);
  const [logoAgencia, setLogoAgencia] = useState(null);
  const [datosAgencia, setDatosAgencia] = useState(DATOS_AGENCIA_VACIOS);
  const agenciaId = usuario?.agencia_id;

  const [vendedores, setVendedores] = useState(() => vendedoresPorDefecto(usuario));
  const [vendedorLetra, setVendedorLetra] = useState(() => vendedoresPorDefecto(usuario)[0].letra);
  const [numeroCotizacion, setNumeroCotizacion] = useState(null);
  const [proximoNumero, setProximoNumero] = useState(null);
  const [nuevoVendedorNombre, setNuevoVendedorNombre] = useState("");
  const [nuevoVendedorLetra, setNuevoVendedorLetra] = useState("");
  const [nuevoVendedorTel, setNuevoVendedorTel] = useState("");
  const [showVendedorForm, setShowVendedorForm] = useState(false);

  const [operadores, setOperadores] = useState(DEFAULT_OPERADORES);
  const [showOperadores, setShowOperadores] = useState(false);
  const [showDatosAgencia, setShowDatosAgencia] = useState(false);
  const [nuevoOpNombre, setNuevoOpNombre] = useState("");
  const [nuevoOpPctGasto, setNuevoOpPctGasto] = useState("");
  const [nuevoOpReserva, setNuevoOpReserva] = useState("");
  const [nuevoOpFeeEmision, setNuevoOpFeeEmision] = useState("");
  const [nuevoOpPctComision, setNuevoOpPctComision] = useState("");

  const [cliente, setCliente] = useState("");
  const [destino, setDestino] = useState("");
  const [fechaViaje, setFechaViaje] = useState("");
  const [paxCount, setPaxCount] = useState(2);
  const [moneda, setMoneda] = useState("USD");
  const [tituloPrograma, setTituloPrograma] = useState("");
  const [duracionPrograma, setDuracionPrograma] = useState("");
  const [detalleVuelos, setDetalleVuelos] = useState("");
  const [showDatosPrograma, setShowDatosPrograma] = useState(false);

  // ---- Opciones (cada una elige, por cada destino detectado, qué ítem usar) ----
  const [opciones, setOpciones] = useState([]);
  const [modoSumaDirecta, setModoSumaDirecta] = useState(false);
  const [vistaLiquidacion, setVistaLiquidacion] = useState(null); // null = cotizador, objeto = liquidación

  const [items, setItems] = useState([]);
  const [feePristine, setFeePristine] = useState("");
  const [bulkTipoHabitacion, setBulkTipoHabitacion] = useState("");
  const [bulkRegimen, setBulkRegimen] = useState("");
  const [familiasRegistradas, setFamiliasRegistradas] = useState([]);
  const [opcionConfirmada, setOpcionConfirmada] = useState(null);
  const [opcionesConfirmadasPorFamilia, setOpcionesConfirmadasPorFamilia] = useState({}); // { familiaId: opcionId }
  const [titularGeneral, setTitularGeneral] = useState({ nombre: "", documento: "", tel: "", email: "", cuit: "", localidad: "" });
  const [pagosOperadores, setPagosOperadores] = useState({});
  const [showDetalleOp, setShowDetalleOp] = useState({});
  const [showDetalleReal, setShowDetalleReal] = useState({});
  const [editingMontoOpId, setEditingMontoOpId] = useState(null);
  const [cobrosClientes, setCobrosClientes] = useState({});     // { pagadorId: { pagos: [] } }

  // ---- Clientes y pasajeros en base de datos ----
  const [clientesSugeridos, setClientesSugeridos] = useState([]);  // resultados de búsqueda
  const [clienteBusquedaOpen, setClienteBusquedaOpen] = useState(false);
  const [clienteGuardadoEstado, setClienteGuardadoEstado] = useState("idle"); // idle | saving | saved | error
  const [clienteIdSeleccionado, setClienteIdSeleccionado] = useState(null);  // uuid del cliente en BD
  const [pasajeroGuardadoEstado, setPasajeroGuardadoEstado] = useState({}); // { familiaId | "titular": "idle|saving|saved|error" }
  const [pasajerosLista, setPasajerosLista] = useState([]); // lista de pasajeros adicionales al titular

  // ---- Sistema de guardado de cotizaciones ----
  const [cotizaciones, setCotizaciones] = useState([]);
  const [showPanelCotizaciones, setShowPanelCotizaciones] = useState(false);
  const [busquedaCot, setBusquedaCot] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("todos");
  const [sortCot, setSortCot] = useState("fecha");
  const [sortCotDir, setSortCotDir] = useState("desc");
  const [guardadoEstado, setGuardadoEstado] = useState("idle");
  const [ultimoGuardado, setUltimoGuardado] = useState(null);
  const [cotId, setCotId] = useState(null);
  const [cotEstado, setCotEstado] = useState("En curso");
  const autoSaveTimerRef = React.useRef(null);
  const datosTimerRef = React.useRef(null);
  const cotIdRef = React.useRef(null);            // id vigente aunque el closure del autoguardado sea viejo
  const guardandoNuevaRef = React.useRef(false);  // evita insertar dos veces la misma cotización

  // ---- Campos para la versión del pasajero ----
  const [textoIntro, setTextoIntro] = useState("");
  const [vigencia, setVigencia] = useState("72 horas hábiles");
  const [opcionesBadge, setOpcionesBadge] = useState({});
  const [opcionesTexto, setOpcionesTexto] = useState({});


  useEffect(() => { cotIdRef.current = cotId; }, [cotId]);

  // ---- Configuración por agencia (tabla configuracion, clave + agencia_id) ----
  async function cfgGet(clave) {
    if (!agenciaId) throw new Error("Usuario sin agencia asignada");
    const { data, error } = await supabase.from("configuracion").select("valor")
      .eq("clave", clave).eq("agencia_id", agenciaId).maybeSingle();
    if (error) throw error;
    return data ? data.valor : null;
  }

  async function cfgSet(clave, valor) {
    if (!agenciaId) throw new Error("Usuario sin agencia asignada");
    const { error } = await supabase.from("configuracion").upsert({ clave, valor, agencia_id: agenciaId });
    if (error) throw error;
  }

  useEffect(() => {
    let cancelled = false;
    // Cotización abierta desde el historial: se restaura antes de habilitar el autoguardado
    if (cotizacionInicial && cotizacionInicial.datos) aplicarEstadoCot(cotizacionInicial.datos, cotizacionInicial.id);
    async function load() {
      let warn = false;
      // Operadores
      try {
        const v = await cfgGet("operadores");
        if (!cancelled) {
          if (Array.isArray(v) && v.length) setOperadores(v);
          else if (v == null || Array.isArray(v)) await cfgSet("operadores", DEFAULT_OPERADORES);
        }
      } catch (e) { warn = true; }
      // Vendedores
      try {
        const v = await cfgGet("vendedores");
        if (!cancelled) {
          if (Array.isArray(v) && v.length) {
            setVendedores(v);
            setVendedorLetra((prev) => (v.some((x) => x.letra === prev) ? prev : v[0].letra));
          } else if (v == null || Array.isArray(v)) {
            const def = vendedoresPorDefecto(usuario);
            await cfgSet("vendedores", def);
          }
        }
      } catch (e) { warn = true; }
      if (!cancelled) {
        setStorageWarning(warn);
        setStorageReady(true);
      }
      // Logo y datos de la agencia
      try {
        const v = await cfgGet("logo_agencia");
        if (!cancelled && v) setLogoAgencia(v);
      } catch (e) { /* sin logo configurado todavía */ }
      try {
        const v = await cfgGet("datos_agencia");
        if (!cancelled && v && typeof v === "object") setDatosAgencia({ ...DATOS_AGENCIA_VACIOS, ...v });
      } catch (e) { /* sin datos configurados todavía */ }
      // Índice de cotizaciones del usuario
      if (!cancelled) await loadCotizaciones();
    }
    load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- Auto-guardado: dispara cuando cambia el contenido de la cotización ----
  useEffect(() => {
    if (!storageReady) return;
    triggerAutoSave();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, opciones, familiasRegistradas, cliente, destino, fechaViaje, paxCount, moneda, feePristine, vigencia, textoIntro, opcionesBadge, opcionesTexto, bulkTipoHabitacion, bulkRegimen]);



  // ---- Próximo número disponible para el vendedor seleccionado ----
  useEffect(() => {
    if (numeroCotizacion) return;
    let cancelled = false;
    async function peek() {
      try {
        const v = await cfgGet("correlativo:" + vendedorLetra);
        if (!cancelled) setProximoNumero((parseInt(v, 10) || 0) + 1);
      } catch (e) {
        if (!cancelled) setProximoNumero(1);
      }
    }
    peek();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vendedorLetra, numeroCotizacion]);

  async function asignarNumero() {
    try {
      // Si la lectura falla NO se escribe: pisaría el contador con 1
      const v = await cfgGet("correlativo:" + vendedorLetra);
      const next = (parseInt(v, 10) || 0) + 1;
      await cfgSet("correlativo:" + vendedorLetra, next);
      setNumeroCotizacion(vendedorLetra + "-" + String(next).padStart(4, "0"));
    } catch (e) {
      setNumeroCotizacion(vendedorLetra + "-" + String(proximoNumero || 1).padStart(4, "0") + " (sin guardar)");
    }
  }

  function liberarNumero() {
    setNumeroCotizacion(null);
  }

  // ---- Logo y datos de la agencia ----
  async function persistLogoAgencia(base64) {
    setLogoAgencia(base64);
    try {
      await cfgSet("logo_agencia", base64);
    } catch (e) {
      setStorageWarning(true);
    }
  }

  async function eliminarLogoAgencia() {
    setLogoAgencia(null);
    try {
      const { error } = await supabase.from("configuracion").delete().eq("clave", "logo_agencia").eq("agencia_id", agenciaId);
      if (error) throw error;
    } catch (e) {
      setStorageWarning(true);
    }
  }

  // Se guarda 0,8 s después de la última tecla (no un upsert por letra)
  function persistDatosAgencia(campos) {
    setDatosAgencia(campos);
    if (datosTimerRef.current) clearTimeout(datosTimerRef.current);
    datosTimerRef.current = setTimeout(async () => {
      try {
        await cfgSet("datos_agencia", campos);
      } catch (e) {
        setStorageWarning(true);
      }
    }, 800);
  }

  // ---- Operadores ----
  async function persistOperadores(next) {
    setOperadores(next);
    try {
      await cfgSet("operadores", next);
    } catch (e) {
      setStorageWarning(true);
    }
  }

  function addOperador() {
    if (!nuevoOpNombre.trim()) return;
    const next = [
      ...operadores,
      {
        id: uid("op"),
        nombre: nuevoOpNombre.trim(),
        gastoOperador: parseFloat(nuevoOpPctGasto) || 0,
        gastoReserva: parseFloat(nuevoOpReserva) || 0,
        feeEmision: parseFloat(nuevoOpFeeEmision) || 0,
        pctComision: parseFloat(nuevoOpPctComision) || 0,
      },
    ];
    persistOperadores(next);
    setNuevoOpNombre("");
    setNuevoOpPctGasto("");
    setNuevoOpReserva("");
    setNuevoOpFeeEmision("");
    setNuevoOpPctComision("");
  }

  function updateOperador(id, field, value) {
    const next = operadores.map((o) => (o.id === id ? { ...o, [field]: value } : o));
    persistOperadores(next);
  }

  function removeOperador(id) {
    const next = operadores.filter((o) => o.id !== id);
    persistOperadores(next);
  }

  // ---- Vendedores ----
  async function persistVendedores(next) {
    setVendedores(next);
    try {
      await cfgSet("vendedores", next);
    } catch (e) {
      setStorageWarning(true);
    }
  }

  function addVendedor() {
    const letra = nuevoVendedorLetra.trim().toUpperCase().slice(0, 1);
    const nombre = nuevoVendedorNombre.trim();
    const tel = nuevoVendedorTel.trim();
    if (!nombre || !letra) return;
    if (vendedores.some((v) => v.letra === letra)) return;
    const next = [...vendedores, { nombre, letra, tel }];
    persistVendedores(next);
    setNuevoVendedorNombre("");
    setNuevoVendedorLetra("");
    setNuevoVendedorTel("");
    setShowVendedorForm(false);
  }

  // ---- Ítems ----
  function addItem() {
    const firstOp = operadores[0];
    const newItem = {
      id: uid("item"),
      categoria: "",
      descripcion: "",
      descripcionAuto: true,
      noches: "",
      operadorId: firstOp ? firstOp.id : "",
      bruto: "",
      pctComision: firstOp ? firstOp.pctComision : "",
      pctGastoOperador: firstOp ? firstOp.gastoOperador : 0,
      feeEmision: firstOp ? firstOp.feeEmision : 0,
      aplicaFeeEmision: false,
      valorPorPersona: false,
      tarifasMixtas: false,
      tramos: [],
      destino: "",
      familiaId: "",
      // campos estructurados
      incluyeMochila: false,
      incluyeCarryOn: false,
      incluyeBodega: false,
      tipoServicio: "",
      tipoHabitacion: "",
      regimen: "",
      categoriaAuto: "",
      seguroAuto: "",
      tipoCabina: "",
      nivelCobertura: "",
      impuestosFijos: "",       // monto fijo de impuestos/tasas (hoteleros, aéreos, etc.)
      gastoOperadorManual: "",  // monto manual que sobreescribe el % calculado
    };
    setItems((prev) => [...prev, newItem]);
  }

  function duplicateItem(id) {
    setItems((prev) => {
      const idx = prev.findIndex((it) => it.id === id);
      if (idx === -1) return prev;
      const copy = { ...prev[idx], id: uid("item"), familiaId: "" };
      const next = [...prev];
      next.splice(idx + 1, 0, copy);
      return next;
    });
  }

  function removeItem(id) {
    setItems((prev) => prev.filter((it) => it.id !== id));
  }

  // ---- Tramos de tarifa mixta (ADT/CHD/INF dentro de un mismo ítem) ----
  function addTramo(itemId) {
    setItems((prev) =>
      prev.map((it) => {
        if (it.id !== itemId) return it;
        const tramos = [...(it.tramos || []), { id: uid("tramo"), tipo: "ADT", cantidad: 1, valor: "" }];
        return { ...it, tramos };
      })
    );
  }

  function updateTramo(itemId, tramoId, field, value) {
    setItems((prev) =>
      prev.map((it) => {
        if (it.id !== itemId) return it;
        const tramos = (it.tramos || []).map((t) => (t.id === tramoId ? { ...t, [field]: value } : t));
        return { ...it, tramos };
      })
    );
  }

  function removeTramo(itemId, tramoId) {
    setItems((prev) =>
      prev.map((it) => {
        if (it.id !== itemId) return it;
        return { ...it, tramos: (it.tramos || []).filter((t) => t.id !== tramoId) };
      })
    );
  }

  function toggleTarifasMixtas(itemId, activar) {
    setItems((prev) =>
      prev.map((it) => {
        if (it.id !== itemId) return it;
        if (activar && (!it.tramos || it.tramos.length === 0)) {
          return { ...it, tarifasMixtas: true, tramos: [{ id: uid("tramo"), tipo: "ADT", cantidad: 1, valor: it.bruto || "" }] };
        }
        return { ...it, tarifasMixtas: activar };
      })
    );
  }

  function updateItem(id, field, value) {
    setItems((prev) =>
      prev.map((it) => {
        if (it.id !== id) return it;
        if (field === "descripcion") return { ...it, descripcion: value, descripcionAuto: false };
        return { ...it, [field]: value };
      })
    );
  }

  // Para campos que disparan regeneración automática del texto (categoría + estructurados)
  function updateItemStructured(id, field, value) {
    setItems((prev) =>
      prev.map((it) => {
        if (it.id !== id) return it;
        const updated = { ...it, [field]: value };
        if (updated.descripcionAuto) {
          updated.descripcion = buildDescripcion(updated);
        }
        return updated;
      })
    );
  }

  function handleCategoriaChange(id, catId) {
    setItems((prev) =>
      prev.map((it) => {
        if (it.id !== id) return it;
        const updated = { ...it, categoria: catId };
        if (catId === "aereo") updated.aplicaFeeEmision = true;
        updated.valorPorPersona = defaultValorPorPersona(catId);
        if ((catId === "hotel" || catId === "todoincluido")) {
          if (bulkTipoHabitacion && !updated.tipoHabitacion) updated.tipoHabitacion = bulkTipoHabitacion;
          if (bulkRegimen && !updated.regimen) updated.regimen = bulkRegimen;
        }
        if (updated.descripcionAuto || !it.descripcion) {
          updated.descripcionAuto = true;
          updated.descripcion = buildDescripcion(updated);
        }
        return updated;
      })
    );
  }

  function regenerarDescripcion(id) {
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, descripcionAuto: true, descripcion: buildDescripcion(it) } : it))
    );
  }

  function aplicarTipoYRegimenATodos() {
    if (!bulkTipoHabitacion && !bulkRegimen) return;
    setItems((prev) =>
      prev.map((it) => {
        if (it.categoria !== "hotel" && it.categoria !== "todoincluido") return it;
        const updated = {
          ...it,
          tipoHabitacion: bulkTipoHabitacion || it.tipoHabitacion,
          regimen: bulkRegimen || it.regimen,
        };
        if (updated.descripcionAuto) updated.descripcion = buildDescripcion(updated);
        return updated;
      })
    );
  }

  function handleOperadorChange(id, opId) {
    const op = operadores.find((o) => o.id === opId);
    setItems((prev) =>
      prev.map((it) =>
        it.id === id
          ? {
              ...it,
              operadorId: opId,
              pctGastoOperador: op ? op.gastoOperador : it.pctGastoOperador,
              pctComision: op ? op.pctComision : it.pctComision,
              feeEmision: op ? op.feeEmision : it.feeEmision,
            }
          : it
      )
    );
  }

  // ---- Destinos detectados a partir de los ítems cargados ----
  const destinos = useMemo(() => {
    const set = new Set();
    items.forEach((it) => {
      if (it.destino && it.destino.trim()) set.add(it.destino.trim());
    });
    return Array.from(set);
  }, [items]);

  function itemsDeDestino(destinoNombre) {
    return items.filter((it) => it.destino && it.destino.trim() === destinoNombre);
  }

  function paxParaItem(it) {
    if (it.familiaId) {
      const fam = familiasRegistradas.find((f) => f.id === it.familiaId);
      if (fam) return parseFloat(fam.pax) || 0;
    }
    if (familiasRegistradas.length > 0) {
      return familiasRegistradas.reduce((s, f) => s + (parseFloat(f.pax) || 0), 0) || 0;
    }
    return parseFloat(paxCount) || 0;
  }

  // ---- Familias: se declaran de entrada, no se detectan desde los ítems ----
  function addFamilia() {
    setFamiliasRegistradas((prev) => [...prev, { id: uid("fam"), nombre: "", pax: 1, adt: 1, chd: 0, inf: 0, titular: "", documento: "", tel: "", email: "", cuit: "", localidad: "" }]);
  }

  function updateFamiliaNombre(id, nombre) {
    setFamiliasRegistradas((prev) => prev.map((f) => (f.id === id ? { ...f, nombre } : f)));
  }

  function updateFamiliaPax(id, pax) {
    setFamiliasRegistradas((prev) => prev.map((f) => (f.id === id ? { ...f, pax } : f)));
  }
  function updateFamiliaAdt(id, val) {
    const adt = Math.max(0, parseInt(val) || 0);
    setFamiliasRegistradas((prev) => prev.map((f) => {
      if (f.id !== id) return f;
      const chd = parseInt(f.chd) || 0;
      const inf = parseInt(f.inf) || 0;
      return { ...f, adt, pax: adt + chd + inf || 1 };
    }));
  }
  function updateFamiliaChd(id, val) {
    const chd = Math.max(0, parseInt(val) || 0);
    setFamiliasRegistradas((prev) => prev.map((f) => {
      if (f.id !== id) return f;
      const adt = parseInt(f.adt) || 0;
      const inf = parseInt(f.inf) || 0;
      return { ...f, chd, pax: adt + chd + inf || 1 };
    }));
  }
  function updateFamiliaInf(id, val) {
    const inf = Math.max(0, parseInt(val) || 0);
    setFamiliasRegistradas((prev) => prev.map((f) => {
      if (f.id !== id) return f;
      const adt = parseInt(f.adt) || 0;
      const chd = parseInt(f.chd) || 0;
      return { ...f, inf, pax: adt + chd + inf || 1 };
    }));
  }

  function updateFamiliaCampo(id, campo, valor) {
    setFamiliasRegistradas((prev) => prev.map((f) => (f.id === id ? { ...f, [campo]: valor } : f)));
  }

  function removeFamilia(id) {
    setFamiliasRegistradas((prev) => prev.filter((f) => f.id !== id));
    setItems((prev) => prev.map((it) => (it.familiaId === id ? { ...it, familiaId: "" } : it)));
  }

  // ---- Pasajeros adicionales ----
  const PASAJERO_VACIO = () => ({ id: uid("pax"), nombre: "", documento: "", tel: "", email: "", cuit: "", localidad: "", fechaNac: "", genero: "" });
  function addPasajero() { setPasajerosLista((prev) => [...prev, PASAJERO_VACIO()]); }
  function removePasajero(id) { setPasajerosLista((prev) => prev.filter((p) => p.id !== id)); }
  function updatePasajero(id, campo, valor) { setPasajerosLista((prev) => prev.map((p) => p.id === id ? { ...p, [campo]: valor } : p)); }

  // ---- Sistema de guardado de cotizaciones ----
  function buildCotState() {
    return {
      id: cotId,
      estado: cotEstado,
      fechaCreacion: ultimoGuardado || new Date().toISOString(),
      fechaActualizacion: new Date().toISOString(),
      numeroCotizacion,
      vendedorLetra,
      cliente,
      destino,
      fechaViaje,
      paxCount,
      moneda,
      tituloPrograma,
      duracionPrograma,
      detalleVuelos,
      feePristine,
      vigencia,
      textoIntro,
      opcionesBadge,
      opcionesTexto,
      items,
      opciones,
      familiasRegistradas,
      opcionConfirmada,
      opcionesConfirmadasPorFamilia,
      titularGeneral,
      pasajerosLista,
      pagosOperadores,
      cobrosClientes,
      bulkTipoHabitacion,
      bulkRegimen,
      modoSumaDirecta,
    };
  }

  async function loadCotizaciones() {
    if (!usuario?.id || !agenciaId) return;
    try {
      const { data, error } = await supabase.from("cotizaciones")
        .select("id, numero, cliente, destino, estado, fecha_viaje, creado_en, actualizado_en")
        .eq("usuario_id", usuario.id)
        .eq("agencia_id", agenciaId)
        .order("actualizado_en", { ascending: false });
      if (error) throw error;
      setCotizaciones((data || []).map((c) => ({
        id: c.id, numero: c.numero || "(sin número)", cliente: c.cliente || "",
        destino: c.destino || "", estado: c.estado || "En curso",
        fechaViaje: c.fecha_viaje || "", fechaActualizacion: c.actualizado_en, fechaCreacion: c.creado_en,
      })));
    } catch (e) { setCotizaciones([]); }
  }

  async function saveCotizacion(showIndicator = true) {
    if (!usuario?.id || !agenciaId) return;
    const idActual = cotIdRef.current;
    const esNueva = !idActual;
    if (esNueva && guardandoNuevaRef.current) return;
    if (esNueva) guardandoNuevaRef.current = true;
    if (showIndicator) setGuardadoEstado("saving");
    try {
      const state = buildCotState();
      state.id = idActual;
      const now = new Date().toISOString();
      state.fechaActualizacion = now;
      if (!state.fechaCreacion) state.fechaCreacion = now;
      const payload = {
        usuario_id: usuario.id,
        agencia_id: agenciaId,
        numero: state.numeroCotizacion || null,
        cliente: state.cliente || null,
        destino: state.destino || null,
        fecha_viaje: state.fechaViaje || null,
        estado: state.estado || "En curso",
        moneda: state.moneda || "USD",
        datos: state,
        actualizado_en: now,
      };
      if (idActual) {
        const { error } = await supabase.from("cotizaciones").update(payload).eq("id", idActual);
        if (error) throw error;
      } else {
        payload.creado_en = now;
        const { data, error } = await supabase.from("cotizaciones").insert(payload).select("id").single();
        if (error) throw error;
        cotIdRef.current = data.id;
        setCotId(data.id);
      }
      setUltimoGuardado(now);
      if (showIndicator) setGuardadoEstado("saved");
      setTimeout(() => setGuardadoEstado("idle"), 3000);
      await loadCotizaciones();
      // Persistir cliente y pasajeros en background (sin bloquear ni mostrar error al usuario)
      sincronizarClienteYPasajeros().catch(() => {});
    } catch (e) {
      console.error("saveCotizacion:", e);
      if (showIndicator) setGuardadoEstado("error");
      setTimeout(() => setGuardadoEstado("idle"), 4000);
    } finally {
      if (esNueva) guardandoNuevaRef.current = false;
    }
  }

  // Se llama automáticamente al guardar la cotización.
  // Guarda/actualiza cliente y todos los titulares (titular general o por familia) en sus tablas.
  // Silencioso: no muestra indicadores, no bloquea el guardado de la cotización.
  async function sincronizarClienteYPasajeros() {
    if (!agenciaId || !cliente.trim()) return;

    // 1. Resolver cliente_id (usar el vinculado, o buscar/crear)
    let resolvedClienteId = clienteIdSeleccionado;
    if (!resolvedClienteId) {
      // Intentar encontrar por nombre antes de crear (limit(1) para evitar error con maybeSingle en múltiples resultados)
      const q = cliente.trim();
      const apellidoBusqueda = q.split(/[\s,]+/).pop() || q;
      const { data: foundArr } = await supabase
        .from("clientes")
        .select("id")
        .eq("agencia_id", agenciaId)
        .or(`razon_social.ilike.${q},apellido.ilike.${apellidoBusqueda}`)
        .limit(1);
      const found = foundArr && foundArr.length > 0 ? foundArr[0] : null;
      if (found) {
        resolvedClienteId = found.id;
      } else {
        // Crear nuevo cliente con todos los datos disponibles
        const esJuridica = /\b(s\.?a\.?|s\.?r\.?l\.?|s\.?a\.?s\.?|ltda?\.?|corp\.?|inc\.?|cia\.?)\b/i.test(q);
        let payload;
        if (esJuridica) {
          payload = {
            agencia_id: agenciaId,
            tipo: "persona_juridica",
            razon_social: q,
            ...(titularGeneral.email ? { email: titularGeneral.email } : {}),
            ...(titularGeneral.tel ? { telefono: titularGeneral.tel } : {}),
            ...(titularGeneral.cuit ? { cuit_cuil: titularGeneral.cuit } : {}),
            ...(titularGeneral.localidad ? { localidad: titularGeneral.localidad } : {}),
          };
        } else {
          const coma = q.indexOf(",");
          let apellido = "", nombres = "";
          if (coma > -1) { apellido = q.slice(0, coma).trim(); nombres = q.slice(coma + 1).trim(); }
          else { const p = q.split(/\s+/); apellido = p[p.length - 1] || ""; nombres = p.slice(0, -1).join(" ") || ""; }
          payload = {
            agencia_id: agenciaId, tipo: "persona_fisica", apellido, nombres,
            ...(titularGeneral.tel ? { telefono: titularGeneral.tel } : {}),
            ...(titularGeneral.email ? { email: titularGeneral.email } : {}),
            ...(titularGeneral.cuit ? { cuit_cuil: titularGeneral.cuit } : {}),
            ...(titularGeneral.localidad ? { localidad: titularGeneral.localidad } : {}),
          };
        }
        const { data: nuevo } = await supabase.from("clientes").insert(payload).select("id").single();
        if (nuevo) resolvedClienteId = nuevo.id;
      }
      if (resolvedClienteId) setClienteIdSeleccionado(resolvedClienteId);
    }

    // 2. Guardar pasajeros
    async function upsertPasajero(payload) {
      if (payload.nro_documento) {
        const { data: exist } = await supabase.from("pasajeros").select("id")
          .eq("agencia_id", agenciaId).eq("nro_documento", payload.nro_documento).maybeSingle();
        if (exist) { await supabase.from("pasajeros").update(payload).eq("id", exist.id); return; }
      }
      await supabase.from("pasajeros").insert(payload);
    }

    if (familiasRegistradas.length === 0) {
      // Sin familias: guardar titular general si tiene datos mínimos
      // Fallback: si no hay nombre en titular, usar el campo "cliente" como nombre
      const nombreEfectivo = titularGeneral.nombre.trim() || cliente.trim();
      if (nombreEfectivo || titularGeneral.documento) {
        const partes = nombreEfectivo.trim().split(/\s+/);
        const payload = {
          agencia_id: agenciaId,
          ...(resolvedClienteId ? { cliente_id: resolvedClienteId } : {}),
          apellido: partes[partes.length - 1] || nombreEfectivo || "—",
          nombres: partes.slice(0, -1).join(" ") || "",
          nro_documento: titularGeneral.documento || null,
          tipo_doc: titularGeneral.documento ? "DNI" : null,
          telefono: titularGeneral.tel || null,
          ...(titularGeneral.email ? { email: titularGeneral.email } : {}),
          ...(titularGeneral.localidad ? { localidad: titularGeneral.localidad } : {}),
        };
        await upsertPasajero(payload);
      }
    } else {
      // Con familias: guardar titular de cada familia
      for (const fam of familiasRegistradas) {
        const nombreTitular = fam.titular || fam.nombre || "";
        if (!nombreTitular && !fam.documento) continue;
        const partes = nombreTitular.trim().split(/\s+/);
        const payload = {
          agencia_id: agenciaId,
          ...(resolvedClienteId ? { cliente_id: resolvedClienteId } : {}),
          apellido: partes[partes.length - 1] || nombreTitular || "—",
          nombres: partes.slice(0, -1).join(" ") || "",
          nro_documento: fam.documento || null,
          tipo_doc: fam.documento ? "DNI" : null,
          telefono: fam.tel || null,
          ...(fam.email ? { email: fam.email } : {}),
          ...(fam.localidad ? { localidad: fam.localidad } : {}),
          observaciones: fam.nombre
            ? `Familia: ${fam.nombre} (${fam.pax} pax, ${fam.adt || 0} ADT/${fam.chd || 0} CHD/${fam.inf || 0} INF)`
            : null,
        };
        await upsertPasajero(payload);
      }
    }

    // Pasajeros adicionales (siempre, independiente de si hay familias)
    for (const pax of pasajerosLista) {
      if (!pax.nombre && !pax.documento) continue;
      const partes = (pax.nombre || "").trim().split(/\s+/);
      const payloadPax = {
        agencia_id: agenciaId,
        ...(resolvedClienteId ? { cliente_id: resolvedClienteId } : {}),
        apellido: partes[partes.length - 1] || pax.nombre || "—",
        nombres: partes.slice(0, -1).join(" ") || "",
        nro_documento: pax.documento || null,
        tipo_doc: pax.documento ? "DNI" : null,
        telefono: pax.tel || null,
        ...(pax.email ? { email: pax.email } : {}),
        ...(pax.localidad ? { localidad: pax.localidad } : {}),
        ...(pax.fechaNac ? { fecha_nacimiento: pax.fechaNac } : {}),
        ...(pax.genero ? { genero: pax.genero } : {}),
      };
      await upsertPasajero(payloadPax);
    }
  }

  function triggerAutoSave() {
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(() => saveCotizacion(false), 3000);
  }

  // Vuelca un estado guardado en todos los campos del cotizador
  function aplicarEstadoCot(state, id) {
    setNumeroCotizacion(state.numeroCotizacion || null);
    setVendedorLetra(state.vendedorLetra || vendedorLetra);
    setCliente(state.cliente || "");
    setDestino(state.destino || "");
    setFechaViaje(state.fechaViaje || "");
    setPaxCount(state.paxCount || 2);
    setMoneda(state.moneda || "USD");
    setTituloPrograma(state.tituloPrograma || "");
    setDuracionPrograma(state.duracionPrograma || "");
    setDetalleVuelos(state.detalleVuelos || "");
    setFeePristine(state.feePristine || "");
    setVigencia(state.vigencia || "72 horas hábiles");
    setTextoIntro(state.textoIntro || "");
    setOpcionesBadge(state.opcionesBadge || {});
    setOpcionesTexto(state.opcionesTexto || {});
    setItems(state.items || []);
    setOpciones(state.opciones || []);
    setFamiliasRegistradas(state.familiasRegistradas || []);
    setOpcionConfirmada(state.opcionConfirmada || null);
    const confCargada = state.opcionesConfirmadasPorFamilia || {};
    // Limpiar confirmaciones automáticas del código viejo (valor "unico" auto-seteado)
    const confLimpia = Object.fromEntries(Object.entries(confCargada).filter(([, v]) => v !== "unico"));
    setOpcionesConfirmadasPorFamilia(confLimpia);
    setTitularGeneral(state.titularGeneral || { nombre: "", documento: "", tel: "", email: "", cuit: "", localidad: "" });
    setPasajerosLista(state.pasajerosLista || []);
    setPagosOperadores(state.pagosOperadores || {});
    setCobrosClientes(state.cobrosClientes || {});
    setBulkTipoHabitacion(state.bulkTipoHabitacion || "");
    setBulkRegimen(state.bulkRegimen || "");
    setModoSumaDirecta(state.modoSumaDirecta || false);
    cotIdRef.current = id;
    setCotId(id);
    setCotEstado(state.estado || "En curso");
    setUltimoGuardado(state.fechaActualizacion || null);
  }

  async function loadCotizacion(id) {
    try {
      const { data, error } = await supabase.from("cotizaciones").select("datos, estado").eq("id", id).maybeSingle();
      if (error || !data || !data.datos) throw new Error("No encontrado");
      aplicarEstadoCot({ ...data.datos, estado: data.estado || data.datos.estado }, id);
      setShowPanelCotizaciones(false);
    } catch (e) {
      alert("No se pudo cargar la cotización.");
    }
  }

  function nuevaCotizacion() {
    if (cotId) saveCotizacion(false);
    cotIdRef.current = null;
    setCotId(null);
    setCotEstado("En curso");
    setNumeroCotizacion(null);
    setCliente("");
    setDestino("");
    setFechaViaje("");
    setPaxCount(2);
    setMoneda("USD");
    setTituloPrograma("");
    setDuracionPrograma("");
    setDetalleVuelos("");
    setFeePristine("");
    setVigencia("72 horas hábiles");
    setTextoIntro("");
    setOpcionesBadge({});
    setOpcionesTexto({});
    setItems([]);
    setOpciones([]);
    setFamiliasRegistradas([]);
    setOpcionConfirmada(null);
    setOpcionesConfirmadasPorFamilia({});
    setTitularGeneral({ nombre: "", documento: "", tel: "", email: "", cuit: "", localidad: "" });
    setPasajerosLista([]);
    setPagosOperadores({});
    setCobrosClientes({});
    setBulkTipoHabitacion("");
    setBulkRegimen("");
    setModoSumaDirecta(false);
    setUltimoGuardado(null);
    setGuardadoEstado("idle");
    setShowPanelCotizaciones(false);
  }

  function replicarCotizacion() {
    if (cotId) saveCotizacion(false);
    // Copiar ítems sin valores (bruto vacío, tramos con valor 0)
    const itemsReplicados = items.map((it) => ({
      ...it,
      id: uid("it"),
      bruto: "",
      tramos: it.tramos ? it.tramos.map((t) => ({ ...t, valor: "" })) : [],
    }));
    // Copiar familias sin cambios (misma estructura, ajustarán cantidades)
    const familiasReplicadas = familiasRegistradas.map((f) => ({ ...f, id: uid("fam") }));
    // Resetear todo y cargar la réplica
    cotIdRef.current = null;
    setCotId(null);
    setCotEstado("En curso");
    setNumeroCotizacion(null);
    setCliente("");
    setFechaViaje("");
    setTextoIntro("");
    setOpcionesBadge({});
    setOpcionesTexto({});
    setOpciones([]);
    setOpcionConfirmada(null);
    setOpcionesConfirmadasPorFamilia({});
    setTitularGeneral({ nombre: "", documento: "", tel: "", email: "", cuit: "", localidad: "" });
    setPasajerosLista([]);
    setPagosOperadores({});
    setCobrosClientes({});
    setUltimoGuardado(null);
    setGuardadoEstado("idle");
    setShowPanelCotizaciones(false);
    // Mantener: destino, paxCount, moneda, feePristine, vigencia, tituloPrograma, duracionPrograma
    setItems(itemsReplicados);
    setFamiliasRegistradas(familiasReplicadas);
  }

  async function cambiarEstadoCot(id, nuevoEstado) {
    try {
      const now = new Date().toISOString();
      const { data: row, error: e1 } = await supabase.from("cotizaciones").select("datos").eq("id", id).maybeSingle();
      if (e1 || !row) throw new Error("No encontrada");
      // el estado se guarda en la columna Y dentro de datos, para que no vuelva al viejo al reabrirla
      const datos = { ...(row.datos || {}), estado: nuevoEstado, fechaActualizacion: now };
      const { error } = await supabase.from("cotizaciones").update({ estado: nuevoEstado, datos, actualizado_en: now }).eq("id", id);
      if (error) throw error;
      if (cotId === id) setCotEstado(nuevoEstado);
      await loadCotizaciones();
    } catch (e) { alert("Error al cambiar estado."); }
  }

  async function eliminarCotizacion(id, estadoActual) {
    if ((estadoActual === "Aprobada" || estadoActual === "Cancelada")) {
      const conf = window.prompt(`Esta cotización está "${estadoActual}". Escribí CONFIRMAR para eliminarla.`);
      if (conf !== "CONFIRMAR") return;
    }
    try {
      const { error } = await supabase.from("cotizaciones").delete().eq("id", id);
      if (error) throw error;
      if (cotId === id) nuevaCotizacion();
      await loadCotizaciones();
    } catch (e) { alert("Error al eliminar."); }
  }

  async function eliminarDescartadas() {
    const ids = cotizaciones.filter((c) => c.estado === "Descartada").map((c) => c.id);
    if (!ids.length) return;
    try {
      const { error } = await supabase.from("cotizaciones").delete().in("id", ids);
      if (error) throw error;
    } catch (e) { alert("Error al eliminar las descartadas."); }
    await loadCotizaciones();
  }

  // ---- Búsqueda de clientes en BD ----
  async function buscarClientes(query) {
    if (!agenciaId || !query || query.trim().length < 2) {
      setClientesSugeridos([]);
      return;
    }
    try {
      const q = query.trim().toLowerCase();
      const { data, error } = await supabase
        .from("clientes")
        .select("id, tipo, apellido, nombres, razon_social, cuit_cuil, email, telefono")
        .eq("agencia_id", agenciaId)
        .or(`apellido.ilike.%${q}%,nombres.ilike.%${q}%,razon_social.ilike.%${q}%`)
        .order("apellido", { ascending: true })
        .limit(8);
      if (error) throw error;
      setClientesSugeridos(data || []);
    } catch (e) {
      setClientesSugeridos([]);
    }
  }

  function nombreDisplayCliente(c) {
    if (c.tipo === "persona_juridica") return c.razon_social || "(sin nombre)";
    const partes = [c.apellido, c.nombres].filter(Boolean);
    return partes.join(", ") || "(sin nombre)";
  }

  function seleccionarClienteDesdeDB(c) {
    const nombre = nombreDisplayCliente(c);
    setCliente(nombre);
    setClienteIdSeleccionado(c.id);
    // Si hay titular general vacío, prellenar con los datos del cliente
    if (!titularGeneral.nombre) {
      setTitularGeneral((t) => ({
        ...t,
        nombre: c.tipo === "persona_fisica" ? [c.nombres, c.apellido].filter(Boolean).join(" ") : (c.razon_social || ""),
        documento: c.cuit_cuil || t.documento,
        tel: c.telefono || t.tel,
        email: c.email || t.email,
        localidad: c.localidad || t.localidad,
      }));
    }
    setClientesSugeridos([]);
    setClienteBusquedaOpen(false);
  }

  // ---- Guardar / actualizar cliente en BD ----
  async function guardarClienteEnBD() {
    if (!agenciaId || !cliente.trim()) return;
    setClienteGuardadoEstado("saving");
    try {
      // Si ya tenemos un id seleccionado, no duplicamos — solo confirmamos
      if (clienteIdSeleccionado) {
        setClienteGuardadoEstado("saved");
        setTimeout(() => setClienteGuardadoEstado("idle"), 3000);
        return;
      }
      // Detectar si es persona jurídica: si el texto tiene más de 3 palabras o contiene S.A./SRL/SAS etc.
      const esJuridica = /\b(s\.?a\.?|s\.?r\.?l\.?|s\.?a\.?s\.?|ltda?\.?|corp\.?|inc\.?|cia\.?)\b/i.test(cliente);
      let payload;
      if (esJuridica) {
        payload = { agencia_id: agenciaId, tipo: "persona_juridica", razon_social: cliente.trim() };
      } else {
        // Intentar separar apellido y nombres: "García, Juan" o "Juan García"
        const coma = cliente.indexOf(",");
        let apellido = "", nombres = "";
        if (coma > -1) {
          apellido = cliente.slice(0, coma).trim();
          nombres = cliente.slice(coma + 1).trim();
        } else {
          const partes = cliente.trim().split(/\s+/);
          apellido = partes[partes.length - 1] || "";
          nombres = partes.slice(0, -1).join(" ") || "";
        }
        payload = { agencia_id: agenciaId, tipo: "persona_fisica", apellido, nombres };
      }
      // Agregar titular si hay datos
      if (titularGeneral.tel) payload.telefono = titularGeneral.tel;
      const { data, error } = await supabase.from("clientes").insert(payload).select("id").single();
      if (error) throw error;
      setClienteIdSeleccionado(data.id);
      setClienteGuardadoEstado("saved");
      setTimeout(() => setClienteGuardadoEstado("idle"), 3000);
    } catch (e) {
      console.error("guardarClienteEnBD:", e);
      setClienteGuardadoEstado("error");
      setTimeout(() => setClienteGuardadoEstado("idle"), 4000);
    }
  }

  // ---- Guardar pasajero en BD ----
  async function guardarPasajeroEnBD(tipo, familiaId) {
    if (!agenciaId) return;
    const key = familiaId || "titular";
    setPasajeroGuardadoEstado((prev) => ({ ...prev, [key]: "saving" }));
    try {
      let payload = { agencia_id: agenciaId };
      // Asignar cliente_id si tenemos uno
      if (clienteIdSeleccionado) payload.cliente_id = clienteIdSeleccionado;

      if (tipo === "titular") {
        // Sin familias: usar titularGeneral
        if (!titularGeneral.nombre && !titularGeneral.documento) throw new Error("Sin datos");
        const partes = (titularGeneral.nombre || "").trim().split(/\s+/);
        payload.apellido = partes[partes.length - 1] || titularGeneral.nombre || "—";
        payload.nombres = partes.slice(0, -1).join(" ") || "";
        payload.nro_documento = titularGeneral.documento || null;
        payload.telefono = titularGeneral.tel || null;
        payload.tipo_doc = titularGeneral.documento ? "DNI" : null;
      } else {
        // Con familias: usar datos de la familia
        const fam = familiasRegistradas.find((f) => f.id === familiaId);
        if (!fam) throw new Error("Familia no encontrada");
        if (!fam.titular && !fam.nombre) throw new Error("Sin datos de titular");
        const nombreTitular = fam.titular || fam.nombre || "";
        const partes = nombreTitular.trim().split(/\s+/);
        payload.apellido = partes[partes.length - 1] || nombreTitular || "—";
        payload.nombres = partes.slice(0, -1).join(" ") || "";
        payload.nro_documento = fam.documento || null;
        payload.telefono = fam.tel || null;
        payload.tipo_doc = fam.documento ? "DNI" : null;
        payload.observaciones = fam.nombre ? `Familia: ${fam.nombre} (${fam.pax} pax, ${fam.adt || 0} ADT/${fam.chd || 0} CHD/${fam.inf || 0} INF)` : null;
      }

      // Upsert por agencia_id + nro_documento (si hay doc), o insertar nuevo
      if (payload.nro_documento) {
        const { data: exist } = await supabase
          .from("pasajeros")
          .select("id")
          .eq("agencia_id", agenciaId)
          .eq("nro_documento", payload.nro_documento)
          .maybeSingle();
        if (exist) {
          await supabase.from("pasajeros").update(payload).eq("id", exist.id);
        } else {
          await supabase.from("pasajeros").insert(payload);
        }
      } else {
        await supabase.from("pasajeros").insert(payload);
      }

      setPasajeroGuardadoEstado((prev) => ({ ...prev, [key]: "saved" }));
      setTimeout(() => setPasajeroGuardadoEstado((prev) => ({ ...prev, [key]: "idle" })), 3000);
    } catch (e) {
      console.error("guardarPasajeroEnBD:", e);
      setPasajeroGuardadoEstado((prev) => ({ ...prev, [key]: "error" }));
      setTimeout(() => setPasajeroGuardadoEstado((prev) => ({ ...prev, [key]: "idle" })), 4000);
    }
  }

  async function exportarBackup() {
    if (!usuario?.id || !agenciaId) return;
    try {
      const { data, error } = await supabase.from("cotizaciones").select("id, datos")
        .eq("usuario_id", usuario.id).eq("agencia_id", agenciaId);
      if (error) throw error;
      const backup = {};
      (data || []).forEach((c) => { backup[c.id] = c.datos; });
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = "backup-cotizaciones.json";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch (e) { alert("No se pudo generar el backup."); }
  }

  // ---- Opciones ----
  function addOpcion() {
    const selecciones = {};
    destinos.forEach((d) => {
      if (familiasRegistradas.length > 0) {
        const porFamilia = {};
        familiasRegistradas.forEach((fam) => {
          const candidatos = itemsDeDestino(d).filter((it) => !it.familiaId || it.familiaId === fam.id);
          porFamilia[fam.id] = candidatos[0] ? candidatos[0].id : "";
        });
        selecciones[d] = porFamilia;
      } else {
        const candidatos = itemsDeDestino(d);
        selecciones[d] = candidatos[0] ? candidatos[0].id : "";
      }
    });
    setOpciones((prev) => [...prev, { id: uid("opcion"), nombre: "Opción " + (prev.length + 1), selecciones }]);
  }

  function updateOpcionNombre(id, nombre) {
    setOpciones((prev) => prev.map((o) => (o.id === id ? { ...o, nombre } : o)));
  }

  function updateOpcionSeleccion(id, destinoNombre, itemId) {
    setOpciones((prev) =>
      prev.map((o) => (o.id === id ? { ...o, selecciones: { ...o.selecciones, [destinoNombre]: itemId } } : o))
    );
  }

  function updateOpcionSeleccionFamilia(id, destinoNombre, familiaId, itemId) {
    setOpciones((prev) =>
      prev.map((o) => {
        if (o.id !== id) return o;
        const actual = o.selecciones[destinoNombre] || {};
        return { ...o, selecciones: { ...o.selecciones, [destinoNombre]: { ...actual, [familiaId]: itemId } } };
      })
    );
  }

  function removeOpcion(id) {
    setOpciones((prev) => prev.filter((o) => o.id !== id));
  }

  // ---- Totales por grupo ----
  const grupos = useMemo(() => {
    if (destinos.length === 0 || modoSumaDirecta || opciones.length === 0) {
      return [{ id: "unico", nombre: null, items: items, incompleta: false }];
    }
    return opciones.map((op) => {
      const incompleta =
        familiasRegistradas.length > 0
          ? destinos.some((d) => {
              const sel = op.selecciones[d] || {};
              return familiasRegistradas.some((fam) => !sel[fam.id]);
            })
          : destinos.some((d) => !op.selecciones[d]);
      return {
        id: op.id,
        nombre: op.nombre,
        incompleta,
        items: items.filter((it) => {
          if (!it.destino || !it.destino.trim()) return true;
          const sel = op.selecciones[it.destino.trim()];
          if (familiasRegistradas.length > 0) {
            if (!sel || typeof sel !== "object") return false;
            if (it.familiaId) return sel[it.familiaId] === it.id;
            return Object.values(sel).includes(it.id);
          }
          return sel === it.id;
        }),
      };
    });
  }, [items, destinos, opciones, familiasRegistradas]);

  const resultados = useMemo(() => {
    return grupos.map((g) => {
      if (familiasRegistradas.length === 0) {
        return { ...g, familiaResultados: null, totales: computeGroup(g.items, operadores, feePristine, paxCount) };
      }
      const familiaResultados = familiasRegistradas.map((f) =>
        computeFamiliaShare(g.items, f, familiasRegistradas, operadores, feePristine)
      );
      return { ...g, familiaResultados, totales: null };
    });
  }, [grupos, operadores, feePristine, paxCount, familiasRegistradas]);

  const minTotal = useMemo(() => {
    if (familiasRegistradas.length > 0) return null;
    if (resultados.length < 2) return null;
    return Math.min(...resultados.map((r) => r.totales.totalFinal));
  }, [resultados, familiasRegistradas]);

  const minTotalPorFamilia = useMemo(() => {
    const map = {};
    if (familiasRegistradas.length === 0 || resultados.length < 2) return map;
    familiasRegistradas.forEach((f) => {
      const vals = resultados
        .map((r) => r.familiaResultados.find((x) => x.familiaId === f.id))
        .filter(Boolean)
        .map((fr) => fr.totalFinal);
      if (vals.length > 1) map[f.id] = Math.min(...vals);
    });
    return map;
  }, [resultados, familiasRegistradas]);

  const hotelesSinDestino = useMemo(() => {
    if (opciones.length === 0) return [];
    return items.filter(
      (it) => (it.categoria === "hotel" || it.categoria === "todoincluido") && (!it.destino || !it.destino.trim())
    );
  }, [items, opciones]);

  function escapeHtml(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function buildResultCardHtml(title, subtitle, t, paxLabel) {
    return `
      <div class="result-card">
        <div class="result-title">${escapeHtml(title)}</div>
        ${subtitle ? `<div class="result-subtitle">${escapeHtml(subtitle)}</div>` : ""}
        <div class="row muted"><span>Total bruto</span><span>${fmtMoneda(t.totalBruto, moneda)}</span></div>
        <div class="row muted"><span>+ Fee Pristine</span><span>${fmtMoneda(t.fee, moneda)}</span></div>
        <div class="row muted"><span>Comisión + fee (comisionable)</span><span>${fmtMoneda(t.gananciaComisionable, moneda)}</span></div>
        <div class="row"><span>+ Gastos Pristine (42% = 21+6+15)</span><span>${fmtMoneda(t.gastosPristine, moneda)}</span></div>
        <div class="row"><span>+ Gastos operador (%)</span><span>${fmtMoneda(t.totalGastoOperadorPct, moneda)}</span></div>
        <div class="row"><span>+ Gastos de reserva</span><span>${fmtMoneda(t.totalGastoReserva, moneda)}</span></div>
        <div class="row"><span>+ Fee de emisión</span><span>${fmtMoneda(t.totalFeeEmision, moneda)}</span></div>
        <div class="row muted"><span>Subtotal</span><span>${fmtMoneda(t.subtotal, moneda)}</span></div>
        <div class="row"><span>+ Gastos bancarios (1,2%)</span><span>${fmtMoneda(t.gastosBancarios, moneda)}</span></div>
        <div class="row final"><span>Total a pagar</span><span>${fmtMoneda(t.totalFinal, moneda)}</span></div>
        <div class="total-pax">
          <div class="label">Por pasajero (${escapeHtml(paxLabel)})</div>
          <div class="amount">${fmtMoneda(t.totalPorPasajero, moneda)}</div>
        </div>
      </div>
    `;
  }

  function subtituloHotelesDe(r) {
    if (!(destinos.length > 0 && opciones.length > 0)) return "";
    const opcion = opciones.find((o) => o.id === r.id);
    if (!opcion) return "";
    const partes = destinos
      .map((d) => {
        const it = items.find((x) => x.id === opcion.selecciones[d]);
        return it ? shortLabel(it) : null;
      })
      .filter(Boolean);
    return partes.join(" + ");
  }

  function subtituloFamiliaDe(r, fr) {
    if (!(destinos.length > 0 && opciones.length > 0)) return "";
    const opcion = opciones.find((o) => o.id === r.id);
    if (!opcion) return "";
    const partes = destinos
      .map((d) => {
        const sel = opcion.selecciones[d];
        const itemId = sel && typeof sel === "object" ? sel[fr.familiaId] : sel;
        const it = items.find((x) => x.id === itemId);
        return it ? shortLabel(it) : null;
      })
      .filter(Boolean);
    return partes.join(" + ");
  }

  function buildVistaImpresionHtml(modo = "interno") {
    const vendedorObj = vendedores.find((v) => v.letra === vendedorLetra) || {};
    const vendedorNombre = vendedorObj.nombre || vendedorLetra;
    const vendedorTel = vendedorObj.tel || "";
    const esInterno = modo === "interno";

    // ---- VERSIÓN INTERNA COMPLETA ----
    if (esInterno) {
      const mFmt = MONEDAS[moneda] || MONEDAS.USD;

      // Tabla de ítems
      function itemsHtmlTable() {
        if (!items.length) return "<p style='color:#6B6F85;font-size:12px;'>Sin ítems cargados.</p>";
        const cats = CATEGORIAS.reduce((m, c) => { m[c.id] = c.label; return m; }, {});
        const opNombre = (id) => (operadores.find((o) => o.id === id) || {}).nombre || "—";
        const famNombre = (id) => { const f = familiasRegistradas.find((f) => f.id === id); return f ? f.nombre || "(sin nombre)" : "Compartido"; };
        const rows = items.map((it) => {
          const valorCell = it.tarifasMixtas && Array.isArray(it.tramos) && it.tramos.length
            ? it.tramos.map((t) => {
                const cant = parseFloat(t.cantidad) || 0;
                const val = parseFloat(t.valor) || 0;
                return `<div style="font-size:11px;line-height:1.6"><strong>${escapeHtml(t.tipo || "")}</strong> ×${cant} · ${mFmt.prefix} ${fmt(val)}</div>`;
              }).join("") + `<div style="font-size:11px;font-weight:700;border-top:1px solid #E1E3EE;margin-top:2px;padding-top:2px">= ${mFmt.prefix} ${fmt(it.tramos.reduce((s,t)=>s+(parseFloat(t.cantidad)||0)*(parseFloat(t.valor)||0),0))}</div>`
            : `${mFmt.prefix} ${fmt(parseFloat(it.bruto) || 0)}`;
          return `<tr>
  <td>${escapeHtml(it.descripcion || "—")}</td>
  <td>${escapeHtml(cats[it.categoria] || it.categoria || "—")}</td>
  <td>${escapeHtml(opNombre(it.operadorId))}</td>
  <td style="text-align:right">${valorCell}</td>
  <td style="text-align:center">${it.valorPorPersona ? "✓" : ""}</td>
  <td style="text-align:right">${it.pctComision || 0}%</td>
  <td>${escapeHtml(it.destino || "Compartido")}</td>
  <td>${escapeHtml(famNombre(it.familiaId))}</td>
</tr>`;
        }).join("");
        return `<table class="tabla-items">
<thead><tr>
  <th>Descripción</th><th>Categoría</th><th>Operador</th>
  <th style="text-align:right">Valor</th><th style="text-align:center">x pax</th>
  <th style="text-align:right">%Com</th><th>Destino</th><th>Familia</th>
</tr></thead>
<tbody>${rows}</tbody>
</table>`;
      }

      // Opciones
      function opcionesHtmlTable() {
        if (!destinos.length || !opciones.length) return "";
        const filas = opciones.map((o) => {
          const celdas = destinos.map((d) => {
            const sel = o.selecciones[d];
            if (familiasRegistradas.length > 0 && sel && typeof sel === "object") {
              return familiasRegistradas.map((fam) => {
                const it = items.find((x) => x.id === sel[fam.id]);
                return `<td><span style="font-size:10px;color:#6B6F85">${escapeHtml(fam.nombre || "Fam.")}: </span>${escapeHtml(it ? (it.descripcion || d) : "—")}</td>`;
              }).join("");
            }
            const it = items.find((x) => x.id === sel);
            return `<td>${escapeHtml(it ? (it.descripcion || d) : "—")}</td>`;
          }).join("");
          return `<tr><td><strong>${escapeHtml(o.nombre || "Opción")}</strong></td>${celdas}</tr>`;
        }).join("");
        const encabezadoDestinos = destinos.map((d) => {
          if (familiasRegistradas.length > 0) {
            return familiasRegistradas.map((fam) => `<th>${escapeHtml(d)} / ${escapeHtml(fam.nombre || "Fam.")}</th>`).join("");
          }
          return `<th>${escapeHtml(d)}</th>`;
        }).join("");
        return `<table class="tabla-items"><thead><tr><th>Opción</th>${encabezadoDestinos}</tr></thead><tbody>${filas}</tbody></table>`;
      }

      // Resultados completos
      let resultadosHtml = "";
      if (familiasRegistradas.length === 0) {
        resultadosHtml = resultados
          .map((r) => buildResultCardHtml(r.nombre || "Resultado", subtituloHotelesDe(r), r.totales, `${paxCount || 1} pax`))
          .join("");
      } else {
        resultadosHtml = resultados.map((r) => {
          const familyCards = r.familiaResultados
            .map((fr) => buildResultCardHtml(`${fr.familiaNombre} (${fr.paxFamilia} pax)`, subtituloFamiliaDe(r, fr), fr, `${fr.paxFamilia} pax`))
            .join("");
          return `<div class="opcion-group"><div class="opcion-title">${escapeHtml(r.nombre || "Resultado")}</div><div class="opcion-familias">${familyCards}</div></div>`;
        }).join("");
      }

      // Familias
      const familiasHtml = familiasRegistradas.length
        ? `<div class="bloque"><div class="bloque-titulo">Familias / grupos de pasajeros</div>
${familiasRegistradas.map((f) => `<span class="tag-chip">${escapeHtml(f.nombre || "(sin nombre)")} — ${f.pax} pax</span>`).join(" ")}</div>`
        : "";

      // Operadores usados
      const opUsados = [...new Set(items.filter((it) => it.operadorId).map((it) => it.operadorId))];
      const opDetalleHtml = opUsados.length
        ? `<div class="bloque"><div class="bloque-titulo">Operadores utilizados</div>
<table class="tabla-items"><thead><tr><th>Nombre</th><th style="text-align:right">% Gastos op.</th><th style="text-align:right">Gasto reserva</th><th style="text-align:right">Fee emisión</th><th style="text-align:right">% Comisión</th></tr></thead>
<tbody>${opUsados.map((id) => {
  const op = operadores.find((o) => o.id === id);
  if (!op) return "";
  return `<tr><td>${escapeHtml(op.nombre)}</td><td style="text-align:right">${op.gastoOperador || 0}%</td><td style="text-align:right">${mFmt.prefix} ${fmt(parseFloat(op.gastoReserva) || 0)}</td><td style="text-align:right">${mFmt.prefix} ${fmt(parseFloat(op.feeEmision) || 0)}</td><td style="text-align:right">${op.pctComision || 0}%</td></tr>`;
}).join("")}</tbody></table></div>`
        : "";

      const internoCss = [
        "* { box-sizing:border-box; }",
        "body { font-family:-apple-system,'Segoe UI',Helvetica,Arial,sans-serif; color:#1B1D2A; background:#fff; margin:0; padding:24px; font-size:12.5px; }",
        ".top-note { background:#FFF6E8; border:1px solid #F0D9A8; color:#8A6116; font-size:12px; padding:8px 14px; border-radius:7px; margin-bottom:16px; }",
        "@media print { .top-note { display:none; } * { -webkit-print-color-adjust:exact; print-color-adjust:exact; } }",
        ".header { display:flex; align-items:center; justify-content:space-between; margin-bottom:16px; flex-wrap:wrap; gap:8px; border-bottom:2px solid #1B2E8A; padding-bottom:12px; }",
        ".header img { height:36px; }",
        ".header-meta { text-align:right; font-size:11.5px; color:#6B6F85; line-height:1.6; }",
        ".header-meta strong { color:#1B1D2A; font-size:13px; }",
        ".confid { display:inline-block; background:#FDE8E8; color:#8B1A1A; font-size:10px; font-weight:800; padding:2px 8px; border-radius:4px; text-transform:uppercase; letter-spacing:.06em; margin-bottom:4px; }",
        ".datos { display:grid; grid-template-columns:repeat(auto-fill,minmax(160px,1fr)); gap:8px 16px; background:#F5F6FB; border-radius:8px; padding:12px 14px; margin-bottom:16px; }",
        ".dato-item .lbl { font-size:9.5px; text-transform:uppercase; letter-spacing:.05em; color:#6B6F85; font-weight:700; display:block; }",
        ".dato-item .val { font-size:13px; font-weight:600; }",
        ".bloque { margin-bottom:18px; }",
        ".bloque-titulo { font-size:10.5px; font-weight:800; text-transform:uppercase; letter-spacing:.07em; color:#333898; border-bottom:1.5px solid #333898; padding-bottom:5px; margin-bottom:10px; }",
        ".tabla-items { width:100%; border-collapse:collapse; font-size:11.5px; }",
        ".tabla-items th { text-align:left; font-size:10px; text-transform:uppercase; letter-spacing:.04em; color:#6B6F85; font-weight:700; padding:5px 7px; border-bottom:2px solid #E1E3EE; background:#F8F9FD; }",
        ".tabla-items td { padding:5px 7px; border-bottom:1px solid #F0F1F8; vertical-align:top; }",
        ".tabla-items tr:nth-child(even) td { background:#FAFAFD; }",
        ".opcion-group { margin-bottom:18px; }",
        ".opcion-title { font-size:11.5px; font-weight:700; color:#333898; text-transform:uppercase; letter-spacing:.04em; border-bottom:1px solid #E1E3EE; padding-bottom:6px; margin-bottom:8px; }",
        ".opcion-familias { display:grid; grid-template-columns:repeat(auto-fit,minmax(240px,1fr)); gap:12px; }",
        ".result-card { border:1px solid #E1E3EE; border-radius:8px; padding:13px 15px; break-inside:avoid; margin-bottom:10px; }",
        ".result-title { font-size:11.5px; font-weight:700; color:#333898; text-transform:uppercase; letter-spacing:.04em; }",
        ".result-subtitle { font-size:10.5px; color:#6B6F85; margin-bottom:6px; }",
        ".row { display:flex; justify-content:space-between; font-size:11.5px; padding:3px 0; }",
        ".row.muted { color:#6B6F85; }",
        ".row.final { border-top:2px solid #333898; margin-top:5px; padding-top:6px; font-weight:700; font-size:13px; }",
        ".total-pax { margin-top:10px; text-align:right; }",
        ".total-pax .label { font-size:10px; text-transform:uppercase; letter-spacing:.04em; color:#6B6F85; font-weight:700; }",
        ".total-pax .amount { font-size:20px; font-weight:800; color:#C8861B; }",
        ".tag-chip { display:inline-block; background:#EEF0FA; color:#333898; font-size:11.5px; font-weight:600; padding:3px 10px; border-radius:999px; margin:2px; }",
        ".fee-row { display:flex; gap:20px; align-items:center; font-size:12px; }",
      ].join("\n");

      return `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Cotización interna — ${escapeHtml(numeroCotizacion || datosAgencia.nombre || "Cotización")}</title>
<style>${internoCss}</style></head><body>
<div class="top-note">Presioná Ctrl+P (Cmd+P en Mac) para guardar como PDF.</div>

<div class="header">
  ${logoAgencia ? `<img src="${logoAgencia}" alt="Logo" style="max-height:36px;max-width:180px;object-fit:contain;"/>` : `<strong style="font-size:16px;">${escapeHtml(datosAgencia.nombre || "")}</strong>`}
  <div class="header-meta">
    <span class="confid">COTIZACIÓN INTERNA — CONFIDENCIAL</span>
    <strong>${escapeHtml(numeroCotizacion || "(sin número asignado)")}</strong>
    Vendedor: ${escapeHtml(vendedorNombre)} · Estado: ${escapeHtml(cotEstado)}
  </div>
</div>

<div class="datos">
  <div class="dato-item"><span class="lbl">Cliente</span><span class="val">${escapeHtml(cliente || "—")}</span></div>
  <div class="dato-item"><span class="lbl">Destino(s)</span><span class="val">${escapeHtml(destino || "—")}</span></div>
  <div class="dato-item"><span class="lbl">Fecha de viaje</span><span class="val">${escapeHtml(fechaViaje || "—")}</span></div>
  <div class="dato-item"><span class="lbl">Pasajeros</span><span class="val">${escapeHtml(String(paxCount || 1))}</span></div>
  <div class="dato-item"><span class="lbl">Moneda</span><span class="val">${escapeHtml(mFmt.label)}</span></div>
  <div class="dato-item"><span class="lbl">Vigencia</span><span class="val">${escapeHtml(vigencia || "—")}</span></div>
  ${tituloPrograma ? `<div class="dato-item"><span class="lbl">Programa</span><span class="val">${escapeHtml(tituloPrograma)}${duracionPrograma ? " · " + escapeHtml(duracionPrograma) : ""}</span></div>` : ""}
</div>

${familiasHtml}
${opDetalleHtml}

${items.length ? `<div class="bloque"><div class="bloque-titulo">Ítems cargados (${items.length})</div>${itemsHtmlTable()}</div>` : ""}

${feePristine ? `<div class="bloque"><div class="bloque-titulo">Fee Pristine</div><div class="fee-row"><span>${mFmt.prefix} ${fmt(parseFloat(feePristine))} por persona</span><span style="color:#6B6F85">× ${familiasRegistradas.length > 0 ? familiasRegistradas.map((f) => f.nombre + " (" + f.pax + " pax)").join(" / ") : (paxCount || 1) + " pax"}</span></div></div>` : ""}

${opciones.length > 0 ? `<div class="bloque"><div class="bloque-titulo">Opciones configuradas</div>${opcionesHtmlTable()}</div>` : ""}

<div class="bloque"><div class="bloque-titulo">Resultados</div>${resultadosHtml}</div>

<script>window.onload=function(){try{window.print();}catch(e){}}</script>
</body></html>`;
    }

    // ---- VERSIÓN PASAJERO ----

    function iconoCat(cat) {
      const m = { aereo:"✈️", traslado:"🚌", hotel:"🏨", todoincluido:"🏖️", auto:"🚗", asistencia:"🛡️",
        excursion:"🗺️", crucero:"🚢", seguro:"📋", entrada:"🎟️", tren:"🚆", ferry:"⛴️",
        guia:"🧑‍💼", wifi:"📶", equipaje:"🧳", checkout:"🛎️", evento:"🎉", vip:"🌟", fasttrack:"⚡", personalizado:"📌" };
      return m[cat] || "📌";
    }

    function renderServicioRow(it) {
      const extras = [];
      if (it.tipoHabitacion) extras.push(it.tipoHabitacion);
      if (it.regimen) extras.push(it.regimen);
      if (it.noches && parseFloat(it.noches) > 0) extras.push(`${it.noches} noches`);
      return `<div class="srv-row">
  <span class="srv-ico">${iconoCat(it.categoria)}</span>
  <span class="srv-txt">${escapeHtml(it.descripcion || "")}${extras.length ? `<span class="srv-extra"> — ${extras.join(" · ")}</span>` : ""}</span>
</div>`;
    }

    // ítems sin Familia ni Destino: compartidos por todos
    const itemsCompartidosSinDestino = items.filter((it) => !it.familiaId && (!it.destino || !it.destino.trim()));

    // Resumen de noches por destino (para la ficha)
    const nochesResumen = destinos.map((d) => {
      const h = items.find((it) => (it.categoria === "hotel" || it.categoria === "todoincluido") && it.destino && it.destino.trim() === d && parseFloat(it.noches) > 0);
      return h ? `${h.noches} noches en ${d}` : null;
    }).filter(Boolean);

    // Noches totales para la ficha
    const nochesTotales = (() => {
      const ns = items.filter((it) => (it.categoria === "hotel" || it.categoria === "todoincluido") && parseFloat(it.noches) > 0);
      if (!ns.length) return "";
      const t = ns.reduce((s, it) => s + parseFloat(it.noches), 0);
      return `${t} noches`;
    })();

    // Pax display
    const paxN = familiasRegistradas.length > 0
      ? familiasRegistradas.map((f) => `${f.nombre || "Familia"}: ${f.pax} pax`).join(" · ")
      : `${paxCount || 1} pasajeros`;


    const pasajeroCss = [
      "* { box-sizing:border-box; margin:0; padding:0; }",
      "body { font-family:-apple-system,'Segoe UI',Helvetica,Arial,sans-serif; color:#1A1C2B; background:#fff; }",
      ".pagina { max-width:720px; margin:0 auto; padding:28px 20px 48px; }",
      ".top-note { background:#FFF6E8; border:1px solid #F0D9A8; color:#8A6116; font-size:12px; padding:9px 14px; border-radius:8px; margin-bottom:22px; }",
      "@media print { .top-note { display:none; } * { -webkit-print-color-adjust:exact; print-color-adjust:exact; } }",
      ".header-band { background:#1B2E8A; border-radius:14px; padding:22px 24px; display:flex; justify-content:space-between; align-items:center; margin-bottom:22px; flex-wrap:wrap; gap:12px; }",
      ".header-band img { height:44px; filter:brightness(0) invert(1); }",
      ".tagline { font-size:10px; letter-spacing:.12em; text-transform:uppercase; color:rgba(255,255,255,.55); margin-top:5px; }",
      ".hdr-meta { text-align:right; line-height:1.6; }",
      ".hdr-cliente { font-size:16px; font-weight:800; color:#fff; }",
      ".hdr-sub { font-size:11.5px; color:rgba(255,255,255,.65); }",
      ".ficha-viaje { display:grid; grid-template-columns:repeat(auto-fill,minmax(140px,1fr)); gap:8px; margin-bottom:24px; }",
      ".ficha-item { background:#F4F5FB; border-radius:9px; padding:11px 14px; }",
      ".ficha-lbl { font-size:9.5px; text-transform:uppercase; letter-spacing:.06em; color:#6470A0; font-weight:700; display:block; margin-bottom:3px; }",
      ".ficha-val { font-size:13.5px; font-weight:700; color:#1A1C2B; }",
      ".intro-texto { font-size:14.5px; line-height:1.75; color:#1A1C2B; margin-bottom:28px; padding:18px 20px 18px 22px; border-left:4px solid #C8861B; background:#FFFBF3; border-radius:0 10px 10px 0; }",
      ".seccion { margin-bottom:26px; }",
      ".seccion-titulo { font-size:10.5px; font-weight:800; text-transform:uppercase; letter-spacing:.08em; color:#2B3FA0; border-bottom:2px solid #2B3FA0; padding-bottom:6px; margin-bottom:12px; }",
      ".noches-resumen { font-size:13.5px; font-weight:700; color:#2B3FA0; background:#EEF1FA; border-radius:7px; padding:8px 13px; margin-bottom:10px; }",
      ".srv-row { display:flex; align-items:flex-start; gap:10px; font-size:13px; padding:8px 13px; background:#F5F6FB; border-radius:8px; margin-bottom:5px; line-height:1.45; }",
      ".srv-ico { font-size:16px; flex-shrink:0; }",
      ".srv-txt { flex:1; }",
      ".srv-extra { color:#6470A0; font-size:12px; }",
      ".vuelos-pre { font-family:'Menlo','Consolas',monospace; font-size:11.5px; background:#F5F6FB; border-radius:9px; padding:14px 16px; white-space:pre-wrap; line-height:1.6; }",
      ".opcion-card { border:2px solid #E1E3EE; border-radius:14px; padding:22px; margin-bottom:20px; break-inside:avoid; }",
      ".badge-opcion { display:inline-block; font-size:10.5px; font-weight:800; padding:4px 12px; border-radius:999px; text-transform:uppercase; letter-spacing:.05em; margin-bottom:10px; background:#2B3FA0; color:#fff; }",
      ".opcion-nombre { font-size:18px; font-weight:900; color:#1A1C2B; margin-bottom:6px; }",
      ".opcion-texto-comercial { font-size:13.5px; line-height:1.65; color:#3A3D50; margin:8px 0 14px; }",
      ".precio-block { background:#F4F5FB; border-radius:10px; padding:16px 18px; margin-top:16px; display:flex; align-items:center; flex-wrap:wrap; gap:12px; }",
      ".precio-principal { font-size:28px; font-weight:900; color:#C8861B; }",
      ".precio-label { font-size:12px; font-weight:400; color:#6470A0; }",
      ".precio-total-num { font-size:16px; font-weight:700; color:#1A1C2B; }",
      ".familia-card { background:#F8F9FD; border-radius:10px; padding:16px; margin-bottom:10px; }",
      ".familia-nombre { font-size:11.5px; font-weight:800; text-transform:uppercase; letter-spacing:.06em; color:#2B3FA0; margin-bottom:10px; border-bottom:1px solid #E1E3EE; padding-bottom:6px; }",
      ".familias-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(240px,1fr)); gap:14px; margin-top:10px; }",
      ".notas { font-size:12px; color:#6470A0; line-height:1.8; margin:22px 0; padding:14px 16px; background:#F8F9FD; border-radius:9px; }",
      ".notas span { display:block; }",
      ".cta-grid { display:flex; gap:12px; flex-wrap:wrap; margin:24px 0; }",
      ".btn-cta { display:inline-block; padding:13px 24px; border-radius:10px; font-size:14.5px; font-weight:800; text-decoration:none; color:#fff; }",
      ".btn-wa { background:#25D366; }",
      ".btn-pagos { background:#2B3FA0; }",
      ".pie-autoridad { text-align:center; font-size:11px; color:#9CA3BD; margin:18px 0 12px; }",
      ".qr-bloque { display:flex; align-items:center; gap:20px; padding:16px 18px; border:1.5px dashed #CDD0E3; border-radius:10px; }",
      ".qr-placeholder { width:80px; height:80px; background:#F0F1FA; border-radius:8px; border:1px dashed #9CA3BD; display:flex; align-items:center; justify-content:center; flex-shrink:0; font-size:10px; color:#9CA3BD; text-align:center; }",
      ".qr-txt { font-size:12px; color:#6470A0; line-height:1.65; }",
      ".qr-txt strong { color:#1A1C2B; font-size:13px; display:block; margin-bottom:4px; }",
      ".opcion-recomendada { border:2px solid #C8861B; background:#FFFBF3; }",
      ".badge-rec { background:#C8861B; }",
      ".op-servicios { margin:12px 0 16px; }",
      ".op-srv-row { display:flex; align-items:flex-start; gap:8px; font-size:12.5px; padding:6px 10px; border-radius:6px; margin-bottom:4px; background:#F5F6FB; line-height:1.4; }",
      ".op-wa-btn { font-size:13px; padding:10px 18px; border-radius:8px; }",
      ".pie-autoridad { text-align:center; font-size:11px; color:#9CA3BD; margin:18px 0 12px; }",
    ].join("\n");

    const itemsCompartidosSinDestinoLocal = items.filter((it) => !it.familiaId && (!it.destino || !it.destino.trim()));
    const resumenGenericoHtml = (() => {
      // Categorías presentes entre todos los ítems compartidos
      const cats = new Set(items.filter((it) => !it.familiaId).map((it) => it.categoria));
      const lineas = [];
      if (cats.has("aereo")) {
        const aereos = items.filter((it) => !it.familiaId && it.categoria === "aereo");
        const tipoVuelo = aereos.find((it) => it.tipoVuelo)?.tipoVuelo || "";
        const equipajes = [];
        if (aereos.some((it) => it.incluyeMochila)) equipajes.push("mochila");
        if (aereos.some((it) => it.incluyeCarryOn)) equipajes.push("carry-on");
        if (aereos.some((it) => it.incluyeBodega)) equipajes.push("bodega");
        lineas.push("✈️ Vuelos según itinerario"
          + (tipoVuelo ? " · " + tipoVuelo : "")
          + (equipajes.length ? " · equipaje: " + equipajes.join(", ") : ""));
      }
      if (cats.has("traslado")) {
        const traslados = items.filter((it) => !it.familiaId && it.categoria === "traslado");
        const tipo = traslados.find((it) => it.tipoServicio)?.tipoServicio || "";
        lineas.push("🚌 Traslados incluidos" + (tipo ? " · " + tipo : ""));
      }
      if (cats.has("hotel") || cats.has("todoincluido")) {
        const noches = nochesTotales ? nochesTotales : "";
        lineas.push("🏨 Alojamiento según opciones" + (noches ? " — " + noches : "") + " · habitación y régimen informados en cada tarjeta");
      }
      if (cats.has("asistencia") || cats.has("seguro")) lineas.push("🛡️ Asistencia al viajero");
      if (cats.has("excursion")) lineas.push("🗺️ Excursiones incluidas");
      if (!lineas.length) return "";
      return '<div class="seccion">'
        + '<div class="seccion-titulo">Este viaje incluye</div>'
        + lineas.map((l) => '<div class="srv-row"><span class="srv-txt">' + l + '</span></div>').join("")
        + '</div>';
    })();

    // Vuelos (detalle de Amadeus si está cargado)
    const vuelosHtml = detalleVuelos && detalleVuelos.trim()
      ? '<div class="seccion"><div class="seccion-titulo">✈️ Detalle de vuelos</div><pre class="vuelos-pre">' + escapeHtml(detalleVuelos.trim()) + '</pre></div>'
      : "";

    // Secciones por familia eliminadas (info incluida en tarjetas por familia × opción)
    const familiasHtml = "";

    // Render de una opción individual
    // Render compartido de card HTML
    function renderCardHtml(cfg) {
      const { cardClass, badge, titulo, textoOp, itemsOpcion, pp, total, paxNum, etiquetaPax, fmt } = cfg;
      const serviciosHtml = itemsOpcion.length
        ? '<div class="op-servicios">'
          + itemsOpcion.map((it) => {
              const extras = [];
              if (it.tipoHabitacion) extras.push(it.tipoHabitacion);
              if (it.regimen) extras.push(it.regimen);
              if (it.noches && parseFloat(it.noches) > 0) extras.push(it.noches + " noches");
              if (it.detalleEquipaje) extras.push(it.detalleEquipaje);
              if (it.tipoServicio) extras.push(it.tipoServicio);
              const esHotel = it.categoria === "hotel" || it.categoria === "todoincluido";
              return '<div class="op-srv-row">'
                + '<span class="srv-ico">' + iconoCat(it.categoria) + '</span>'
                + '<span class="srv-txt">'
                + (esHotel ? '<strong>' + escapeHtml(it.descripcion || "") + '</strong>' : escapeHtml(it.descripcion || ""))
                + (extras.length ? '<span class="srv-extra"> — ' + extras.join(" · ") + '</span>' : "")
                + '</span></div>';
            }).join("")
          + '</div>'
        : "";
      const waMsgOp = encodeURIComponent("Hola " + (vendedorNombre || "") + ", me interesa \"" + titulo + "\" de la cotización " + (numeroCotizacion || "") + ".");
      const waBtn = vendedorTel
        ? '<a class="btn-cta btn-wa op-wa-btn" href="https://wa.me/' + escapeHtml(vendedorTel.replace(/[^0-9]/g, "")) + '?text=' + waMsgOp + '">💬 Me interesa esta opción</a>'
        : "";
      return '<div class="' + cardClass + '">'
        + badge
        + '<div class="opcion-nombre">' + titulo + '</div>'
        + (textoOp ? '<div class="opcion-texto-comercial">' + escapeHtml(textoOp).replace(/\n/g, "<br/>") + '</div>' : "")
        + serviciosHtml
        + '<div class="precio-block">'
        + '<div><div class="precio-principal">' + fmt(pp) + '</div><div class="precio-label">por persona</div></div>'
        + '<div><div class="precio-total-num">' + fmt(total) + '</div><div class="precio-label">' + etiquetaPax + '</div></div>'
        + (waBtn ? '<div style="margin-left:auto">' + waBtn + '</div>' : "")
        + '</div></div>';
    }

    // Items de una opción para una familia específica (o global si no hay familias)
    function getItemsOpcion(r, fam) {
      // Si no hay opciones: mostrar todos los ítems relevantes directamente
      if (opciones.length === 0) {
        if (fam) return items.filter((it) => !it.familiaId || it.familiaId === fam.id);
        return items;
      }
      const opObj = opciones.find((o) => o.id === r.id);
      // Compartidos sin destino
      const compartidosSinDestino = items.filter((it) => !it.familiaId && (!it.destino || !it.destino.trim()));
      // Propios de la familia sin destino
      const propiosFam = fam ? items.filter((it) => it.familiaId === fam.id && (!it.destino || !it.destino.trim())) : [];
      // Ítems con destino seleccionados en esta opción
      const deOpcion = (() => {
        if (!destinos.length || !opObj) return [];
        return items.filter((it) => {
          if (!it.destino || !it.destino.trim()) return false;
          const sel = opObj.selecciones && opObj.selecciones[it.destino.trim()];
          if (!sel) return false;
          if (typeof sel === "object") {
            if (fam) return sel[fam.id] === it.id;
            return Object.values(sel).includes(it.id);
          }
          return sel === it.id;
        });
      })();
      // Compartidos con destino que no son seleccionables (traslados, asistencia fija)
      const compartidosConDestino = items.filter((it) =>
        !it.familiaId && it.destino && it.destino.trim() &&
        !deOpcion.find((d) => d.id === it.id) &&
        !opciones.some((o) => {
          const sel = o.selecciones[it.destino.trim()];
          return sel && (typeof sel === "object" ? Object.values(sel).includes(it.id) : sel === it.id);
        })
      );
      return [...compartidosSinDestino, ...compartidosConDestino, ...propiosFam, ...deOpcion];
    }

    // Construir sección de opciones
    const haOpciones = resultados.length > 0;
    const opcionesHtml = (() => {
      if (!haOpciones) return "";
      const tituloSeccion = resultados.length === 1 ? "Tu propuesta" : "Opciones disponibles";
      const simbolo = (MONEDAS && MONEDAS[moneda]) ? MONEDAS[moneda].prefix : (moneda || "USD");
      const fmt = (n) => simbolo + " " + Math.round(n).toLocaleString("es-AR");
      let cards = "";
      if (!familiasRegistradas.length) {
        // Sin familias: una tarjeta por opción
        resultados.forEach((r) => {
          const totales = r.totales || {};
          const paxNum = paxCount || 1;
          const esRec = opcionesBadge && opcionesBadge[r.id] === "recomendada";
          cards += renderCardHtml({
            cardClass: esRec ? "opcion-card opcion-recomendada" : "opcion-card",
            badge: esRec ? '<span class="badge-opcion badge-rec">⭐ Nuestra recomendación</span>' : '<span class="badge-opcion">' + escapeHtml(r.nombre || "Tu propuesta") + '</span>',
            titulo: escapeHtml(r.nombre || "Tu propuesta"),
            textoOp: opcionesTexto && opcionesTexto[r.id] ? opcionesTexto[r.id] : "",
            itemsOpcion: getItemsOpcion(r, null),
            pp: totales.totalFinal ? totales.totalFinal / paxNum : 0,
            total: totales.totalFinal || 0,
            paxNum, etiquetaPax: "total " + paxNum + " pax", fmt,
          });
        });
      } else {
        // Con familias: una tarjeta por familia × opción
        resultados.forEach((r) => {
          familiasRegistradas.forEach((fam) => {
            const frFam = r.familiaResultados && r.familiaResultados.find((x) => x.familiaId === fam.id);
            if (!frFam) return;
            const esRec = opcionesBadge && opcionesBadge[r.id] === "recomendada";
            const paxNum = parseFloat(fam.pax) || 1;
            const titulo = escapeHtml(fam.nombre || "Familia") + " · " + escapeHtml(r.nombre || "Opción");
            cards += renderCardHtml({
              cardClass: esRec ? "opcion-card opcion-recomendada" : "opcion-card",
              badge: '<span class="badge-opcion' + (esRec ? " badge-rec" : "") + '">' + escapeHtml(fam.nombre || "Familia") + (esRec ? " ⭐" : "") + '</span>',
              titulo,
              textoOp: opcionesTexto && opcionesTexto[r.id] ? opcionesTexto[r.id] : "",
              itemsOpcion: getItemsOpcion(r, fam),
              pp: frFam.totalPorPasajero || 0,
              total: frFam.totalFinal || 0,
              paxNum, etiquetaPax: "total " + paxNum + " pax", fmt,
            });
          });
        });
      }
      return '<div class="seccion"><div class="seccion-titulo">' + tituloSeccion + '</div>' + cards + '</div>';
    })();

    // Notas de precio y CTA

    const waHtml = vendedorTel ? `<div class="cta-grid">
  <a class="btn-cta btn-wa" href="https://wa.me/${escapeHtml(vendedorTel.replace(/[^0-9]/g,""))}">💬 Consultá con ${escapeHtml(vendedorNombre)}</a>
  <a class="btn-cta btn-wa-pagos" href="https://wa.me/${escapeHtml(vendedorTel.replace(/[^0-9]/g,""))}?text=${encodeURIComponent(`Hola ${vendedorNombre}, quiero consultar sobre el plan de pagos para la cotización ${numeroCotizacion || ""}`)}">💳 Consultar plan de pagos</a>
</div>` : "";

    return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Propuesta de viaje — ${escapeHtml(cliente || datosAgencia.nombre || "Propuesta")}</title>
<style>${pasajeroCss}</style>
</head>
<body>
<div class="pagina">
  <div class="top-note">Presioná Ctrl+P (Cmd+P en Mac) para guardar como PDF.</div>

  <div class="header-band">
    <div>
      ${logoAgencia ? `<img src="${logoAgencia}" alt="Logo" style="max-height:50px;max-width:200px;object-fit:contain;"/>` : (datosAgencia.nombre ? `<div style="font-size:20px;font-weight:800;color:#fff;">${escapeHtml(datosAgencia.nombre)}</div>` : "")}
      ${datosAgencia.eslogan ? `<div class="tagline">${escapeHtml(datosAgencia.eslogan)}</div>` : ""}
    </div>
    <div class="header-meta">
      <div class="hdr-cliente">${escapeHtml(cliente || "")}</div>
      <div class="hdr-sub">${numeroCotizacion ? escapeHtml(numeroCotizacion) + " · " : ""}Asesor: ${escapeHtml(vendedorNombre)}</div>
    </div>
  </div>

  <div class="ficha-viaje">
    <div class="ficha-item"><span class="ficha-lbl">Destino</span><span class="ficha-val">${escapeHtml(destino || "—")}</span></div>
    <div class="ficha-item"><span class="ficha-lbl">Fecha de viaje</span><span class="ficha-val">${escapeHtml(fechaViaje || "—")}</span></div>
    <div class="ficha-item"><span class="ficha-lbl">Pasajeros</span><span class="ficha-val">${escapeHtml(paxN)}</span></div>
    ${tituloPrograma ? '<div class="ficha-item"><span class="ficha-lbl">Programa</span><span class="ficha-val">' + escapeHtml(tituloPrograma) + (duracionPrograma ? " · " + escapeHtml(duracionPrograma) : "") + '</span></div>' : ""}
  </div>

  ${textoIntro ? '<div class="intro-texto">' + escapeHtml(textoIntro).replace(/\n/g,"<br/>") + '</div>' : ""}
  ${familiasHtml}
  ${vuelosHtml}
  ${opcionesHtml}

  <div class="notas-precio">
    <span>· Precios en ${(MONEDAS && MONEDAS[moneda]) ? MONEDAS[moneda].label : (moneda || "USD")}. Válidos por ${escapeHtml(vigencia)}, sujetos a disponibilidad al momento de la confirmación.</span>
    <span>· Vuelos no reembolsables una vez emitidos. Los hoteles pueden aplicar tasas locales.</span>
    <span>· Pasaportes con vigencia mínima de 6 meses desde la fecha de regreso.</span>
  </div>

  ${waHtml}

  ${datosAgencia.leyenda ? `<div class="pie-autoridad">${escapeHtml(datosAgencia.leyenda)}</div>` : ""}

  <div class="seccion">
    <div class="seccion-titulo">Condiciones generales</div>
    <div class="qr-section">
      <div class="qr-box">
        <span style="font-size:11px;color:#9CA3BD;text-align:center;padding:8px;">QR<br/>próximamente</span>
      </div>
      <div class="qr-text">
        <strong>Leé las condiciones generales de tu viaje</strong>
        Escaneá el código QR para acceder al detalle completo de condiciones, políticas de cancelación, documentación requerida y formas de pago.
      </div>
    </div>
  </div>
</div>
${(datosAgencia.nombre || datosAgencia.telefono || datosAgencia.email || datosAgencia.web) ? `
<div style="margin-top:32px;padding:14px 0;border-top:1px solid #E1E3EE;font-size:11px;color:#9CA3BD;line-height:1.8;text-align:center;">
  ${datosAgencia.nombre ? `<strong style="color:#1A1C2B;">${escapeHtml(datosAgencia.nombre)}</strong>` : ""}
  ${datosAgencia.direccion ? ` · ${escapeHtml(datosAgencia.direccion)}` : ""}
  ${datosAgencia.telefono ? ` · Tel: ${escapeHtml(datosAgencia.telefono)}` : ""}
  ${datosAgencia.email ? ` · ${escapeHtml(datosAgencia.email)}` : ""}
  ${datosAgencia.web ? ` · ${escapeHtml(datosAgencia.web)}` : ""}
</div>` : ""}
<script>window.onload=function(){try{window.print();}catch(e){}}</script>
</body>
</html>`;
  }

  // ---- Módulo de pagos a operadores ----
  // ---- Ítems que efectivamente se van a pagar/cobrar: solo los de la opción confirmada ----
  // ---- Sin familias: ítems de la única opción confirmada ----
  function itemsEfectivosConfirmados() {
    if (modoSumaDirecta || opciones.length === 0) return items;
    if (!opcionConfirmada) return [];
    const r = resultados.find((x) => x.id === opcionConfirmada);
    if (!r) return [];
    if (destinos.length === 0) {
      return r.items || items;
    }
    const opcion = opciones.find((o) => o.id === r.id);
    if (!opcion) return [];
    return items.filter((it) => {
      if (!it.destino || !it.destino.trim()) return true;
      const sel = opcion.selecciones[it.destino.trim()];
      return sel === it.id;
    });
  }

  // ---- Con familias: ítems efectivos de UNA familia específica, según SU PROPIA opción confirmada ----
  function itemsEfectivosDeFamilia(familiaId) {
    const opcionId = opcionesConfirmadasPorFamilia[familiaId];
    // En modo suma directa o sin opciones, incluir todos los ítems de la familia + compartidos
    if (!opcionId || modoSumaDirecta || opciones.length === 0) {
      const propiosDeFamilia = items.filter((it) => it.familiaId === familiaId);
      const compartidos = items.filter((it) => !it.familiaId);
      const vistos = new Set();
      return [...propiosDeFamilia, ...compartidos]
        .filter((it) => { if (vistos.has(it.id)) return false; vistos.add(it.id); return true; });
    }

    // Ítems explícitamente asignados a esta familia (con o sin destino) — siempre incluir
    const propiosDeFamilia = items.filter((it) => it.familiaId === familiaId);

    // Compartidos sin destino — siempre incluir
    const compartidosSinDestino = items.filter((it) => !it.familiaId && (!it.destino || !it.destino.trim()));

    // Compartidos con destino: los que están seleccionados en la opción confirmada de esta familia
    let compartidosConDestinoSeleccionados = [];
    if (destinos.length > 0) {
      const opcionObj = opciones.find((o) => o.id === opcionId);
      if (opcionObj) {
        compartidosConDestinoSeleccionados = items.filter((it) => {
          if (it.familiaId) return false; // los propios ya están arriba
          if (!it.destino || !it.destino.trim()) return false;
          const sel = opcionObj.selecciones[it.destino.trim()];
          if (!sel) return false;
          if (typeof sel === "object") return sel[familiaId] === it.id;
          return sel === it.id;
        });
      }
    }

    // Compartidos con destino que no participan en ninguna opción (ej: traslados fijos)
    const idsYaIncluidos = new Set(compartidosConDestinoSeleccionados.map((i) => i.id));
    const compartidosConDestinoSinOpcion = items.filter((it) =>
      !it.familiaId && it.destino && it.destino.trim() &&
      !idsYaIncluidos.has(it.id) &&
      !opciones.some((o) => {
        const sel = o.selecciones[it.destino.trim()];
        return sel && (typeof sel === "object" ? Object.values(sel).includes(it.id) : sel === it.id);
      })
    );

    // Deduplicar por id
    const vistos = new Set();
    return [...propiosDeFamilia, ...compartidosSinDestino, ...compartidosConDestinoSeleccionados, ...compartidosConDestinoSinOpcion]
      .filter((it) => { if (vistos.has(it.id)) return false; vistos.add(it.id); return true; });
  }

  // ---- Total preciso de UNA familia, según su propia opción confirmada ----
  // El gasto de reserva de cada operador se prorratea SOLO entre las familias que efectivamente lo usan
  // (en cualquiera de sus ítems efectivos, sin importar si están en la misma Opción o en otra distinta).
  function familiaUsaOperador(familiaId, opId) {
    const its = itemsEfectivosDeFamilia(familiaId);
    return its.some((it) => it.operadorId === opId);
  }

  function computeFamiliaConfirmada(familiaId) {
    const familia = familiasRegistradas.find((f) => f.id === familiaId);
    if (!familia) return null;
    const opcionId = opcionesConfirmadasPorFamilia[familiaId];
    if (!opcionId) return null;
    const paxFamilia = parseFloat(familia.pax) || 0;
    // Si opcionId es "unico" (modo suma directa), usar todos los ítems de la familia
    const itemsFamilia = (opcionId === "unico" || modoSumaDirecta || opciones.length === 0)
      ? items.filter((it) => !it.familiaId || it.familiaId === familiaId)
      : itemsEfectivosDeFamilia(familiaId);

    const calcs = itemsFamilia.map((it) => calcItem(it, paxFamilia));
    const totalBruto = calcs.reduce((s, c) => s + c.bruto, 0);
    const totalComision = calcs.reduce((s, c) => s + c.comision, 0);
    const totalGastoOperadorPct = calcs.reduce((s, c) => s + c.gastoOperador, 0);

    const fee = (parseFloat(feePristine) || 0) * paxFamilia;
    const gananciaComisionable = totalComision + fee;
    const gastosPristine = gananciaComisionable * 0.42;

    // Gasto de reserva: por cada operador presente en los ítems de esta familia,
    // prorratear entre todas las familias confirmadas que también usan ese operador.
    const operadoresDeFamilia = new Set(itemsFamilia.filter((it) => it.operadorId).map((it) => it.operadorId));
    let totalGastoReserva = 0;
    operadoresDeFamilia.forEach((opId) => {
      const op = operadores.find((o) => o.id === opId);
      if (!op) return;
      let sumPaxOperador = 0;
      familiasRegistradas.forEach((f) => {
        if (!opcionesConfirmadasPorFamilia[f.id]) return;
        if (familiaUsaOperador(f.id, opId)) sumPaxOperador += parseFloat(f.pax) || 0;
      });
      const share = sumPaxOperador > 0 ? paxFamilia / sumPaxOperador : 0;
      totalGastoReserva += (parseFloat(op.gastoReserva) || 0) * share;
    });

    // Fee de emisión: por la cantidad real de boletos de cada ítem
    let totalFeeEmision = 0;
    itemsFamilia.forEach((it) => {
      if (it.aplicaFeeEmision) {
        totalFeeEmision += (parseFloat(it.feeEmision) || 0) * cantidadBoletosItem(it, paxFamilia);
      }
    });

    const totalGastosOperadorBloque = totalGastoOperadorPct + totalGastoReserva + totalFeeEmision;
    const subtotal = totalBruto + fee + gastosPristine + totalGastosOperadorBloque;
    const gastosBancarios = subtotal * 0.012;
    const totalFinal = subtotal + gastosBancarios;
    const totalPorPasajero = paxFamilia > 0 ? totalFinal / paxFamilia : 0;

    return {
      familiaId,
      familiaNombre: familia.nombre || "Familia sin nombre",
      opcionId,
      paxFamilia,
      totalBruto, totalComision, totalGastoOperadorPct, totalGastoReserva, totalFeeEmision,
      fee, gananciaComisionable, gastosPristine, subtotal, gastosBancarios, totalFinal, totalPorPasajero,
      itemsFamilia,
    };
  }

  function montoCalculadoOperador(opId) {
    const op = operadores.find((o) => o.id === opId);
    if (!op) return 0;

    if (familiasRegistradas.length === 0) {
      const itemsEfectivos = itemsEfectivosConfirmados();
      const itsOp = itemsEfectivos.filter((it) => it.operadorId === opId);
      let total = 0;
      itsOp.forEach((it) => {
        const pax = paxParaItem(it);
        const c = calcItem(it, pax);
        const feeEmisionItem = it.aplicaFeeEmision ? (parseFloat(it.feeEmision) || 0) * cantidadBoletosItem(it, pax) : 0;
        const base = c.neto + feeEmisionItem;
        const pctGasto = parseFloat(it.pctGastoOperador) || 0;
        total += base + (base * pctGasto) / 100;
      });
      total += parseFloat(op.gastoReserva) || 0;
      return total;
    }

    // Con familias: sumar ítems compartidos (una sola vez, con el pax total de familias confirmadas)
    // más los ítems específicos de cada familia que use este operador. El gasto de reserva se paga
    // una sola vez en total (es lo que Pristine le debe al operador), sin importar cuántas familias lo usen.
    const familiasConfirmadas = (modoSumaDirecta || opciones.length === 0)
      ? familiasRegistradas
      : familiasRegistradas.filter((f) => opcionesConfirmadasPorFamilia[f.id]);
    if (!familiasConfirmadas.length) return 0;
    const paxTotalConfirmado = familiasConfirmadas.reduce((s, f) => s + (parseFloat(f.pax) || 0), 0);

    let total = 0;
    let operadorUsado = false;

    // 1. Ítems compartidos SIN destino de este operador (una sola vez con pax total)
    const compartidosSinDestino = items.filter((it) =>
      !it.familiaId && (!it.destino || !it.destino.trim()) && it.operadorId === opId
    );
    compartidosSinDestino.forEach((it) => {
      operadorUsado = true;
      const c = calcItem(it, paxTotalConfirmado);
      const feeEmisionItem = it.aplicaFeeEmision ? (parseFloat(it.feeEmision) || 0) * cantidadBoletosItem(it, paxTotalConfirmado) : 0;
      const base = c.neto + feeEmisionItem;
      const pctGasto = parseFloat(it.pctGastoOperador) || 0;
      total += base + (base * pctGasto) / 100;
    });

    // 2. Ítems compartidos CON destino que no son seleccionables por opción (traslados, asistencia con destino)
    const compartidosConDestino = items.filter((it) =>
      !it.familiaId && it.destino && it.destino.trim() && it.operadorId === opId &&
      !opciones.some((o) => {
        const sel = o.selecciones[it.destino.trim()];
        return sel && (typeof sel === "object" ? Object.values(sel).includes(it.id) : sel === it.id);
      })
    );
    compartidosConDestino.forEach((it) => {
      operadorUsado = true;
      const c = calcItem(it, paxTotalConfirmado);
      const feeEmisionItem = it.aplicaFeeEmision ? (parseFloat(it.feeEmision) || 0) * cantidadBoletosItem(it, paxTotalConfirmado) : 0;
      const base = c.neto + feeEmisionItem;
      const pctGasto = parseFloat(it.pctGastoOperador) || 0;
      total += base + (base * pctGasto) / 100;
    });

    // 3. Por cada familia confirmada: sumar sus ítems propios + los seleccionados por opción
    familiasConfirmadas.forEach((fam) => {
      const paxFam = parseFloat(fam.pax) || 0;
      // Todos los ítems de esta familia para este operador (propios con o sin destino)
      const itsFam = items.filter((it) => it.familiaId === fam.id && it.operadorId === opId);

      if (modoSumaDirecta || opciones.length === 0) {
        // Sin opciones: sumar todo directamente
        itsFam.forEach((it) => {
          operadorUsado = true;
          const c = calcItem(it, paxFam);
          const feeEmisionItem = it.aplicaFeeEmision ? (parseFloat(it.feeEmision) || 0) * cantidadBoletosItem(it, paxFam) : 0;
          const base = c.neto + feeEmisionItem;
          const pctGasto = parseFloat(it.pctGastoOperador) || 0;
          total += base + (base * pctGasto) / 100;
        });
      } else {
        const opcionId = opcionesConfirmadasPorFamilia[fam.id];
        const opcionObj = opciones.find((o) => o.id === opcionId);
        // Propios sin destino
        const propiosSinDestino = itsFam.filter((it) => !it.destino || !it.destino.trim());
        propiosSinDestino.forEach((it) => {
          operadorUsado = true;
          const c = calcItem(it, paxFam);
          const feeEmisionItem = it.aplicaFeeEmision ? (parseFloat(it.feeEmision) || 0) * cantidadBoletosItem(it, paxFam) : 0;
          const base = c.neto + feeEmisionItem;
          const pctGasto = parseFloat(it.pctGastoOperador) || 0;
          total += base + (base * pctGasto) / 100;
        });
        // Seleccionados por opción con destino
        if (opcionObj && destinos.length > 0) {
          destinos.forEach((d) => {
            const sel = opcionObj.selecciones[d];
            if (!sel) return;
            const itemId = typeof sel === "object" ? sel[fam.id] : sel;
            if (!itemId) return;
            const it = items.find((x) => x.id === itemId && x.operadorId === opId);
            if (!it) return;
            operadorUsado = true;
            const c = calcItem(it, paxFam);
            const feeEmisionItem = it.aplicaFeeEmision ? (parseFloat(it.feeEmision) || 0) * cantidadBoletosItem(it, paxFam) : 0;
            const base = c.neto + feeEmisionItem;
            const pctGasto = parseFloat(it.pctGastoOperador) || 0;
            total += base + (base * pctGasto) / 100;
          });
        }
      }
    });

    if (operadorUsado) total += parseFloat(op.gastoReserva) || 0;
    return total;
  }

  function montoEfectivoOperador(opId) {
    const aj = pagosOperadores[opId]?.montoAjustado;
    return aj != null && aj !== "" ? parseFloat(aj) : montoCalculadoOperador(opId);
  }

  function convertirAMonedaCot(importe, monedaPago, tipoCambio) {
    const imp = parseFloat(String(importe || "0").replace(/\./g, "").replace(",", ".")) || 0;
    if (monedaPago === moneda) return imp;
    const tc = parseFloat(tipoCambio) || 1;
    if (moneda === "USD" && monedaPago === "ARS") return imp / tc;
    if (moneda === "USD" && monedaPago === "EUR") return imp * tc;
    if (moneda === "ARS" && monedaPago === "USD") return imp * tc;
    if (moneda === "ARS" && monedaPago === "EUR") return imp * tc;
    if (moneda === "EUR" && monedaPago === "ARS") return imp / tc;
    if (moneda === "EUR" && monedaPago === "USD") return imp / tc;
    return imp;
  }

  function totalPagadoOperador(opId) {
    const pagos = pagosOperadores[opId]?.pagos || [];
    return pagos.reduce((s, p) => s + convertirAMonedaCot(p.importe, p.moneda, p.tipoCambio), 0);
  }

  function addPagoOperador(opId) {
    setPagosOperadores((prev) => {
      const cur = prev[opId] || { montoAjustado: null, pagos: [] };
      return { ...prev, [opId]: { ...cur, pagos: [...cur.pagos, { id: uid("pago"), fecha: "", moneda: moneda, importe: "", tipoCambio: "" }] } };
    });
  }

  function updatePagoOperador(opId, pagoId, campo, valor) {
    setPagosOperadores((prev) => {
      const cur = prev[opId] || { montoAjustado: null, pagos: [] };
      return { ...prev, [opId]: { ...cur, pagos: cur.pagos.map((p) => p.id === pagoId ? { ...p, [campo]: valor } : p) } };
    });
  }

  function removePagoOperador(opId, pagoId) {
    setPagosOperadores((prev) => {
      const cur = prev[opId] || { montoAjustado: null, pagos: [] };
      return { ...prev, [opId]: { ...cur, pagos: cur.pagos.filter((p) => p.id !== pagoId) } };
    });
  }

  function setMontoAjustadoOp(opId, valor) {
    setPagosOperadores((prev) => {
      const cur = prev[opId] || { montoAjustado: null, pagos: [] };
      return { ...prev, [opId]: { ...cur, montoAjustado: valor } };
    });
  }

  function setItemRealOp(opId, itemKey, valor) {
    setPagosOperadores((prev) => {
      const cur = prev[opId] || { montoAjustado: null, pagos: [], itemsReales: {} };
      const itemsReales = { ...(cur.itemsReales || {}), [itemKey]: valor };
      return { ...prev, [opId]: { ...cur, itemsReales } };
    });
  }

  // ---- Módulo de cobros a clientes ----
  function montoCobrarPagador(pagadorId) {
    if (familiasRegistradas.length === 0) {
      if (!opcionConfirmada) return null;
      const r = resultados.find((x) => x.id === opcionConfirmada);
      return r && r.totales ? r.totales.totalFinal : null;
    }
    // Leer siempre de resultados → familiaResultados (misma fuente que la tarjeta confirmada)
    const rFam = (modoSumaDirecta || opciones.length === 0)
      ? resultados[0]
      : resultados.find((x) => x.id === opcionesConfirmadasPorFamilia[pagadorId]);
    const fr = rFam?.familiaResultados?.find((x) => x.familiaId === pagadorId);
    return fr ? fr.totalFinal : null;
  }

  function totalCobradoPagador(pagadorId) {
    const pagos = cobrosClientes[pagadorId]?.pagos || [];
    return pagos.reduce((s, p) => s + convertirAMonedaCot(p.importe, p.moneda, p.tipoCambio), 0);
  }

  function addCobroPagador(pagadorId) {
    setCobrosClientes((prev) => {
      const cur = prev[pagadorId] || { pagos: [] };
      return { ...prev, [pagadorId]: { ...cur, pagos: [...cur.pagos, { id: uid("cobro"), fecha: "", moneda: moneda, importe: "", tipoCambio: "" }] } };
    });
  }

  function updateCobroPagador(pagadorId, pagoId, campo, valor) {
    setCobrosClientes((prev) => {
      const cur = prev[pagadorId] || { pagos: [] };
      return { ...prev, [pagadorId]: { ...cur, pagos: cur.pagos.map((p) => p.id === pagoId ? { ...p, [campo]: valor } : p) } };
    });
  }

  function removeCobroPagador(pagadorId, pagoId) {
    setCobrosClientes((prev) => {
      const cur = prev[pagadorId] || { pagos: [] };
      return { ...prev, [pagadorId]: { ...cur, pagos: cur.pagos.filter((p) => p.id !== pagoId) } };
    });
  }

  function slugify(s) {
    return (s || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function mostrarLiquidacion() {
    const sinOpc = modoSumaDirecta || opciones.length === 0;

    // Sin familias
    if (familiasRegistradas.length === 0) {
      const r = resultados[0];
      if (!r || !r.totales) { alert("Cargá al menos un ítem para generar la liquidación."); return; }
      setVistaLiquidacion({
        tipo: "simple",
        items: items,
        total: r.totales,
        paxCount: paxCount || 1,
      });
      return;
    }

    // Con familias — determinar cuáles incluir
    const hayAlgunaConf = familiasRegistradas.some(f => opcionesConfirmadasPorFamilia[f.id]);
    const famsAMostrar = familiasRegistradas.filter(f => {
      if (sinOpc) return hayAlgunaConf ? !!opcionesConfirmadasPorFamilia[f.id] : true;
      return !!opcionesConfirmadasPorFamilia[f.id];
    });

    if (!famsAMostrar.length) { alert("Confirmá al menos una familia para generar la liquidación."); return; }

    const tarjetas = [];
    famsAMostrar.forEach(fam => {
      const r = sinOpc ? resultados[0] : resultados.find(x => x.id === opcionesConfirmadasPorFamilia[fam.id]);
      if (!r) return;
      let fr = r.familiaResultados ? r.familiaResultados.find(x => x.familiaId === fam.id) : null;
      if (!fr && r.familiaResultados && r.familiaResultados.length > 0) fr = r.familiaResultados[0];
      if (!fr && r.totales) fr = { paxFamilia: parseFloat(fam.pax)||1, totalFinal: r.totales.totalFinal, totalPorPasajero: r.totales.totalPorPasajero };
      if (!fr) return;
      const propios = r.items.filter(it => it.familiaId === fam.id);
      const compartidos = r.items.filter(it => !it.familiaId);
      tarjetas.push({ fam, fr, items: [...propios, ...compartidos] });
    });

    if (!tarjetas.length) { alert("No se encontraron datos para las familias confirmadas."); return; }
    setVistaLiquidacion({ tipo: "familias", tarjetas });
  }

  function buildNombreArchivo(modo) {
    // Extraer año de la fecha de viaje (acepta DD/MM/AAAA o YYYY-MM-DD)
    let anio = "";
    if (fechaViaje) {
      const m = fechaViaje.match(/(\d{4})/);
      if (m) anio = m[1];
    }
    // Cliente slugificado
    const clienteSlug = slugify(cliente);
    // Destino slugificado (reemplaza "/" y "-" por espacio antes de slugify)
    const destinoSlug = slugify((destino || "").replace(/[/\-]/g, " "));
    // Armar partes del nombre
    const partes = [clienteSlug, destinoSlug, anio, slugify(numeroCotizacion)].filter(Boolean);
    const base = partes.length ? partes.join("-") : "cotizacion";
    return modo === "pasajero" ? `propuesta-${base}.html` : `cotizacion-${base}.html`;
  }

  function descargarVistaImpresion(modo = "interno") {
    try {
      const html = buildVistaImpresionHtml(modo);
      if (!html) { alert("No se pudo generar el documento. Verificá que la cotización tenga datos."); return; }
      const ventana = window.open("", "_blank");
      if (!ventana) {
        alert("El navegador bloqueó la ventana emergente. Permití las ventanas emergentes para este sitio y volvé a intentar.");
        return;
      }
      ventana.document.open();
      ventana.document.write(html);
      ventana.document.close();
    } catch(e) {
      alert("Error al generar el documento: " + e.message);
      console.error(e);
    }
  }

  // Vista de liquidación inline
  if (vistaLiquidacion) {
    const mFmt = MONEDAS[moneda] || MONEDAS.USD;
    const fmt = (n) => `${mFmt.prefix} ${(n||0).toLocaleString("es-AR",{minimumFractionDigits:2,maximumFractionDigits:2})}`;
    const icons = { aereo:"✈️", traslado:"🚌", hotel:"🏨", todoincluido:"🏖️", auto:"🚗", asistencia:"🛡️", excursion:"🗺️", crucero:"🚢", seguro:"📋", entrada:"🎟️", tren:"🚆", ferry:"⛴️", guia:"🧑‍💼", wifi:"📶", equipaje:"🧳" };
    const renderItem = (it, fam) => {
      const extras = [];
      if (it.tipoHabitacion) extras.push(it.tipoHabitacion);
      if (it.regimen) extras.push(it.regimen);
      if (it.noches && parseFloat(it.noches) > 0) extras.push(`${it.noches} noches`);
      if (it.tipoVuelo) extras.push(it.tipoVuelo);
      if (it.tipoServicio) extras.push(it.tipoServicio);
      const esCompartido = !it.familiaId && fam;
      const adt = esCompartido ? (parseInt(fam.adt)||0) : 0;
      const chd = esCompartido ? (parseInt(fam.chd)||0) : 0;
      const inf = esCompartido ? (parseInt(fam.inf)||0) : 0;
      const paxPartes = [];
      if (adt>0) paxPartes.push(`${adt} ADT`);
      if (chd>0) paxPartes.push(`${chd} CHD`);
      if (inf>0) paxPartes.push(`${inf} INF`);
      if (!paxPartes.length && esCompartido) paxPartes.push(`${parseInt(fam.pax)||1} pax`);
      return (
        <div key={it.id} style={{ display:"flex", gap:10, padding:"8px 12px", background:"#F5F6FB", borderRadius:7, marginBottom:6, fontSize:13, lineHeight:1.4 }}>
          <span style={{ fontSize:15, flexShrink:0 }}>{icons[it.categoria]||"📌"}</span>
          <div>
            <span style={{ fontWeight:500 }}>{it.descripcion||""}</span>
            {extras.length > 0 && <span style={{ color:"#6470A0", fontSize:12 }}> — {extras.join(" · ")}</span>}
            {esCompartido && <div style={{ fontSize:11.5, color:"#2B3FA0", marginTop:3 }}><span style={{ background:"#EEF1FA", borderRadius:4, padding:"1px 6px", fontWeight:700, fontSize:11, marginRight:4 }}>Compartido</span>{paxPartes.join(" + ")}</div>}
            {it.tarifasMixtas && it.tramos && it.tramos.filter(t=>parseFloat(t.cantidad)>0).length > 0 && (
              <div style={{ fontSize:11.5, color:"#2B3FA0", marginTop:3 }}>
                {it.tramos.filter(t=>parseFloat(t.cantidad)>0).map((t,i) => (
                  <span key={t.tipo}>{i > 0 ? " · " : ""}<span style={{ background:"#EEF1FA", borderRadius:4, padding:"1px 6px", fontWeight:700, fontSize:11, marginRight:2 }}>{t.tipo}</span>× {parseFloat(t.cantidad)}</span>
                ))}
              </div>
            )}
          </div>
        </div>
      );
    };
    const vendedorObj = vendedores.find(v => v.letra === vendedorLetra) || {};
    const vendedorNombre = vendedorObj.nombre || vendedorLetra;
    return (
      <div style={{ fontFamily:"-apple-system,'Segoe UI',Helvetica,Arial,sans-serif", background:"#F4F5FB", minHeight:"100vh", padding:0 }}>
        {/* Barra superior */}
        <div className="no-print" style={{ background:"#1B2E8A", padding:"10px 20px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <span style={{ color:"#fff", fontWeight:700, fontSize:14 }}>LIQUIDACIÓN DE SERVICIOS — {cliente||""}</span>
          <div style={{ display:"flex", gap:8 }}>
            <button onClick={() => window.print()} style={{ background:"#fff", color:"#1B2E8A", border:"none", borderRadius:6, padding:"6px 14px", fontWeight:700, cursor:"pointer", fontSize:13 }}>🖨️ Imprimir / PDF</button>
            <button onClick={() => setVistaLiquidacion(null)} style={{ background:"rgba(255,255,255,.15)", color:"#fff", border:"none", borderRadius:6, padding:"6px 14px", fontWeight:700, cursor:"pointer", fontSize:13 }}>✕ Volver al cotizador</button>
          </div>
        </div>
        {/* Contenido */}
        <div style={{ maxWidth:760, margin:"0 auto", padding:"28px 24px" }}>
          {/* Encabezado */}
          <div style={{ background:"#1B2E8A", borderRadius:12, padding:"20px 24px", display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20, flexWrap:"wrap", gap:14 }}>
            <div>
              {logoAgencia
                ? <img src={logoAgencia} alt="Logo" style={{ maxHeight:42, maxWidth:200, objectFit:"contain", filter:"brightness(0) invert(1)" }}/>
                : (datosAgencia.nombre ? <div style={{ fontSize:18, fontWeight:800, color:"#fff" }}>{datosAgencia.nombre}</div> : null)}
              {datosAgencia.eslogan ? <div style={{ fontSize:10, letterSpacing:".1em", textTransform:"uppercase", color:"rgba(255,255,255,.6)", marginTop:4 }}>{datosAgencia.eslogan}</div> : null}
            </div>
            <div style={{ textAlign:"right", fontSize:12, color:"rgba(255,255,255,.75)", lineHeight:1.6 }}>
              <span style={{ display:"inline-block", background:"rgba(255,255,255,.15)", border:"1px solid rgba(255,255,255,.4)", color:"#fff", fontSize:10, fontWeight:800, padding:"3px 10px", borderRadius:4, textTransform:"uppercase", letterSpacing:".06em", marginBottom:4 }}>LIQUIDACIÓN DE SERVICIOS</span>
              <strong style={{ color:"#fff", fontSize:14, display:"block" }}>{cliente||""}</strong>
              {numeroCotizacion && <span>{numeroCotizacion} · </span>}
              {new Date().toLocaleDateString("es-AR",{day:"2-digit",month:"2-digit",year:"numeric"})} · {vendedorNombre}
            </div>
          </div>
          {/* Ficha */}
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(150px,1fr))", gap:"8px 16px", background:"#F5F6FB", borderRadius:10, padding:"14px 16px", marginBottom:22 }}>
            <div><span style={{ fontSize:"9.5px", textTransform:"uppercase", letterSpacing:".06em", color:"#6470A0", fontWeight:700, display:"block", marginBottom:2 }}>Destino</span><span style={{ fontSize:"13.5px", fontWeight:600 }}>{destino||"—"}</span></div>
            <div><span style={{ fontSize:"9.5px", textTransform:"uppercase", letterSpacing:".06em", color:"#6470A0", fontWeight:700, display:"block", marginBottom:2 }}>Fecha de viaje</span><span style={{ fontSize:"13.5px", fontWeight:600 }}>{fechaViaje||"—"}</span></div>
          </div>

          {vistaLiquidacion.tipo === "simple" && (<>
            <div style={{ fontSize:"10.5px", fontWeight:800, textTransform:"uppercase", letterSpacing:".08em", color:"#2B3FA0", borderBottom:"2px solid #2B3FA0", paddingBottom:5, margin:"20px 0 12px" }}>Servicios confirmados</div>
            {vistaLiquidacion.items.map(it => renderItem(it, null))}
            <div style={{ display:"flex", alignItems:"baseline", gap:16, flexWrap:"wrap", background:"#EEF1FA", borderRadius:10, padding:"14px 18px", margin:"14px 0" }}>
              <div style={{ fontSize:24, fontWeight:900, color:"#C8861B" }}>{fmt(vistaLiquidacion.total.totalPorPasajero)}<span style={{ fontSize:11, fontWeight:400, color:"#6470A0" }}> por persona</span></div>
              <div style={{ fontSize:15, fontWeight:700 }}>{fmt(vistaLiquidacion.total.totalFinal)}<span style={{ fontSize:11, fontWeight:400, color:"#6470A0" }}> total ({vistaLiquidacion.paxCount} pax)</span></div>
            </div>
          </>)}

          {vistaLiquidacion.tipo === "familias" && (<>
            <div style={{ fontSize:"10.5px", fontWeight:800, textTransform:"uppercase", letterSpacing:".08em", color:"#2B3FA0", borderBottom:"2px solid #2B3FA0", paddingBottom:5, margin:"20px 0 12px" }}>Servicios por familia</div>
            {vistaLiquidacion.tarjetas.map(({ fam, fr, items: its }) => (
              <div key={fam.id} style={{ border:"1.5px solid #CDD0E3", borderRadius:12, padding:"18px 20px", marginBottom:20 }}>
                <div style={{ display:"inline-block", background:"#1B2E8A", color:"#fff", fontSize:10, fontWeight:800, letterSpacing:".08em", padding:"3px 10px", borderRadius:999, marginBottom:8 }}>{(fam.nombre||"Familia").toUpperCase()}</div>
                <div style={{ fontSize:17, fontWeight:800, color:"#1B1D2A", marginBottom:14 }}>{fam.nombre||"Familia"}</div>
                <div style={{ fontSize:"10.5px", fontWeight:800, textTransform:"uppercase", letterSpacing:".08em", color:"#2B3FA0", borderBottom:"2px solid #2B3FA0", paddingBottom:5, margin:"0 0 12px" }}>Servicios incluidos</div>
                {its.map(it => renderItem(it, fam))}
                <div style={{ display:"flex", alignItems:"baseline", gap:16, flexWrap:"wrap", background:"#EEF1FA", borderRadius:10, padding:"14px 18px", marginTop:14 }}>
                  <div style={{ fontSize:24, fontWeight:900, color:"#C8861B" }}>{fmt(fr.totalPorPasajero)}<span style={{ fontSize:11, fontWeight:400, color:"#6470A0" }}> por persona</span></div>
                  <div style={{ fontSize:15, fontWeight:700 }}>{fmt(fr.totalFinal)}<span style={{ fontSize:11, fontWeight:400, color:"#6470A0" }}> total ({fr.paxFamilia} pax)</span></div>
                </div>
              </div>
            ))}
            {vistaLiquidacion.tarjetas.length > 1 && (
              <div style={{ background:"#1B2E8A", borderRadius:12, padding:"18px 22px", margin:"24px 0 20px", display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:10 }}>
                <div><div style={{ fontSize:13, fontWeight:700, color:"rgba(255,255,255,.8)", textTransform:"uppercase", letterSpacing:".06em" }}>Total general</div><div style={{ fontSize:12, color:"rgba(255,255,255,.6)" }}>{vistaLiquidacion.tarjetas.reduce((s,t)=>s+t.fr.paxFamilia,0)} pasajeros en total</div></div>
                <div style={{ fontSize:28, fontWeight:900, color:"#fff" }}>{fmt(vistaLiquidacion.tarjetas.reduce((s,t)=>s+t.fr.totalFinal,0))}</div>
              </div>
            )}
          </>)}

          {/* Firma */}
          <div style={{ border:"1.5px dashed #CDD0E3", borderRadius:10, padding:"18px 20px", margin:"20px 0" }}>
            <p style={{ fontSize:"12.5px", color:"#1B1D2A", lineHeight:1.7, margin:"0 0 18px" }}>El/los pasajero/s declaran haber recibido, leído y aceptado la presente liquidación de servicios, incluyendo las condiciones generales aplicables al viaje contratado.</p>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:20 }}>
              {["Firma del titular","Fecha de aceptación","Aclaración (nombre completo)","DNI"].map(label => (
                <div key={label}><div style={{ borderBottom:"1.5px solid #1B1D2A", paddingBottom:4, minHeight:24 }}></div><span style={{ fontSize:10, textTransform:"uppercase", letterSpacing:".05em", color:"#6470A0", fontWeight:700, marginTop:5, display:"block" }}>{label}</span></div>
              ))}
            </div>
          </div>
          {(datosAgencia.nombre || datosAgencia.telefono || datosAgencia.email || datosAgencia.web) && (
            <div style={{ marginTop:8, padding:"12px 0", borderTop:"1px solid #E1E3EE", fontSize:11, color:"#9CA3BD", lineHeight:1.8, textAlign:"center" }}>
              {datosAgencia.nombre && <strong style={{ color:"#1A1C2B" }}>{datosAgencia.nombre}</strong>}
              {datosAgencia.direccion && <> · {datosAgencia.direccion}</>}
              {datosAgencia.telefono && <> · Tel: {datosAgencia.telefono}</>}
              {datosAgencia.email && <> · {datosAgencia.email}</>}
              {datosAgencia.web && <> · {datosAgencia.web}</>}
            </div>
          )}
        </div>
        <style>{`@media print { .no-print { display:none !important; } }`}</style>
      </div>
    );
  }

  return (
    <div className="pristine-app">
      <style>{`
        .pristine-app{--navy:#2B3FA0;--amber:#C8861B;--green:#1B7940;--green-light:#E6F7EC;--red:#F03A2B;--bg:#F4F5FB;--surface:#fff;--border:#DDE0EF;--text:#1A1C2B;--text-soft:#6470A0;--navy-light:#EEF1FA;--navy-mid:#C5CBE8;--amber-light:#FFF6E8;background:var(--bg);color:var(--text);font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;min-height:100%;padding:20px;box-sizing:border-box;max-width:100%;overflow-x:hidden}
        .pristine-app *{box-sizing:border-box}
        .pristine-app input,.pristine-app select,.pristine-app textarea{font-family:inherit;font-size:13px;padding:7px 10px;border:1.5px solid var(--border);border-radius:7px;background:#fff;color:var(--text);width:100%;transition:border-color .15s}
        .pristine-app select{cursor:pointer;padding-right:28px}
        .pristine-app input:focus,.pristine-app select:focus,.pristine-app textarea:focus{outline:none;border-color:var(--navy);box-shadow:0 0 0 3px rgba(43,63,160,.12)}
        .pristine-app .card{background:var(--surface);border:1.5px solid var(--border);border-radius:14px;padding:20px;margin-bottom:14px;box-shadow:0 1px 4px rgba(43,63,160,.06)}
        .pristine-app .result-card{background:var(--surface);border:1.5px solid var(--border);border-radius:12px;padding:18px;box-shadow:0 1px 4px rgba(43,63,160,.06)}
        .pristine-app .section-title{display:flex;align-items:center;gap:8px;font-size:11.5px;font-weight:800;letter-spacing:.07em;text-transform:uppercase;color:var(--navy);margin:0 0 14px;padding:8px 12px;background:var(--navy-light);border-radius:8px}
        .pristine-app .section-title .toggle{margin-left:auto;cursor:pointer;color:var(--text-soft);display:flex;align-items:center}
        .pristine-app .btn-primary{background:var(--navy);color:#fff;border:none;padding:9px 16px;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;display:inline-flex;align-items:center;gap:6px;white-space:nowrap;transition:background .15s}
        .pristine-app .btn-primary:hover{background:#1E2D78}.pristine-app .btn-primary:disabled{background:var(--navy-mid);cursor:default}
        .pristine-app .btn-secondary{background:#fff;border:1.5px solid var(--border);color:var(--text);padding:8px 14px;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;display:inline-flex;align-items:center;gap:6px;white-space:nowrap;transition:background .15s,border-color .15s}
        .pristine-app .btn-secondary:hover{background:var(--navy-light);border-color:var(--navy-mid)}
        .pristine-app .btn-icon{background:transparent;border:none;color:var(--text-soft);cursor:pointer;padding:6px;border-radius:7px;display:inline-flex;transition:background .12s}
        .pristine-app .btn-icon:hover{background:#FBE7E5;color:#B23A2E}.pristine-app .btn-icon.neutral:hover{background:var(--navy-light);color:var(--navy)}
        .pristine-app table.items{width:100%;border-collapse:collapse;font-size:12.5px;table-layout:fixed}
        .pristine-app table.items th{text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.05em;color:var(--text-soft);font-weight:700;padding:6px;border-bottom:2px solid var(--border);background:var(--navy-light);white-space:nowrap;overflow:hidden}
        .pristine-app table.items td{padding:5px 6px;border-bottom:1px solid var(--border);vertical-align:top;word-break:break-word}
        .pristine-app table.items tr:nth-child(even) td{background:#FAFBFF}
        .pristine-app .readonly-cell{color:var(--text-soft);font-variant-numeric:tabular-nums;white-space:nowrap;font-size:12.5px;padding:7px 2px}
        .pristine-app .tag{display:inline-block;font-size:11px;font-weight:700;padding:3px 10px;border-radius:999px;background:var(--navy-light);color:var(--navy);letter-spacing:.02em;border:1px solid var(--navy-mid)}
        .pristine-app .opcion-pill{display:inline-flex;align-items:center;gap:6px;background:var(--navy-light);color:var(--navy);padding:5px 12px;border-radius:999px;font-size:13px;font-weight:600;border:1px solid var(--navy-mid)}
        .pristine-app .pill-select-group{display:flex;flex-wrap:wrap;gap:6px}
        .pristine-app .pill-select{cursor:pointer;font-size:12px;padding:4px 11px;border-radius:999px;background:#F0F2FA;color:var(--text-soft);border:1.5px solid transparent;user-select:none}
        .pristine-app .pill-select:hover{background:var(--navy-light);color:var(--navy)}.pristine-app .pill-select.active{background:var(--navy);color:#fff;font-weight:700}
        .pristine-app .result-row{display:flex;justify-content:space-between;font-size:12.5px;padding:4px 0;color:var(--text);gap:8px}
        .pristine-app .result-row.muted{color:var(--text-soft)}
        .pristine-app .result-row.final{border-top:2px solid var(--navy);margin-top:8px;padding-top:10px;font-weight:800;font-size:14.5px;color:var(--navy)}
        .pristine-app .result-total{font-size:26px;font-weight:900;color:var(--amber);font-variant-numeric:tabular-nums;line-height:1.1}
        .pristine-app .field-label{font-size:10.5px;font-weight:800;color:var(--text-soft);text-transform:uppercase;letter-spacing:.05em;margin-bottom:5px;display:block}
        .pristine-app .helper-text{font-size:11.5px;color:var(--text-soft);margin-top:4px;line-height:1.5}
        .pristine-app .grid-3{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}
        .pristine-app .grid-2{display:grid;grid-template-columns:repeat(2,1fr);gap:14px}
        .pristine-app .badge-best{background:var(--navy);color:#fff;font-size:10px;font-weight:800;padding:3px 9px;border-radius:999px;text-transform:uppercase}
        .pristine-app .badge-warn{background:var(--amber-light);color:#8A6116;font-size:10px;font-weight:800;padding:3px 9px;border-radius:999px;text-transform:uppercase}
        .pristine-app .warning-banner{background:var(--amber-light);border:1.5px solid #F0D9A8;color:#8A6116;font-size:12.5px;padding:10px 14px;border-radius:9px;margin-bottom:14px}
        .pristine-app .structured-fields{display:flex;flex-wrap:wrap;gap:8px;margin-top:6px}
        .pristine-app .structured-fields select{width:auto;min-width:120px;font-size:12px;padding:4px 28px 4px 8px}
        .pristine-app .checkbox-pill{display:inline-flex;align-items:center;gap:5px;font-size:12px;color:var(--text-soft);background:#F0F2FA;padding:4px 9px;border-radius:999px;border:1px solid var(--border)}
        .pristine-app .checkbox-pill input{width:auto;margin:0}
        .pristine-app .auto-tag{font-size:10.5px;color:var(--text-soft);display:inline-flex;align-items:center;gap:4px;margin-top:4px;cursor:pointer}
        .pristine-app .combo-dropdown{position:absolute;top:100%;left:0;right:0;background:#fff;border:1.5px solid var(--border);border-radius:8px;margin-top:3px;max-height:200px;overflow-y:auto;z-index:9999;box-shadow:0 6px 18px rgba(43,63,160,.13)}
        .pristine-app .combo-option{padding:7px 10px;font-size:13px;cursor:pointer}.pristine-app .combo-option:hover{background:var(--navy-light)}
        .pristine-app .combo-option.combo-create{color:var(--navy);font-weight:700;border-top:1px solid var(--border)}
        .pristine-app .cot-table{width:100%;border-collapse:collapse;font-size:12px}
        .pristine-app .cot-table th{text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.04em;color:var(--text-soft);font-weight:800;padding:7px 8px;border-bottom:2px solid var(--border);cursor:pointer;white-space:nowrap;background:var(--navy-light)}
        .pristine-app .cot-table th:hover{color:var(--navy)}.pristine-app .cot-table td{padding:7px 8px;border-bottom:1px solid var(--border);vertical-align:middle}
        .pristine-app .cot-table tr:hover td{background:var(--navy-light)}
        .pristine-app .badge-estado{display:inline-block;font-size:10.5px;font-weight:700;padding:3px 9px;border-radius:999px;letter-spacing:.02em}
        .pristine-app .badge-estado.en-curso{background:var(--navy-light);color:var(--navy)}.pristine-app .badge-estado.enviada{background:var(--amber-light);color:#8A6116}
        .pristine-app .badge-estado.aprobada{background:var(--green-light);color:var(--green)}.pristine-app .badge-estado.cancelada{background:#FDE8E8;color:#8B1A1A}
        .pristine-app .badge-estado.descartada{background:#EBEBEB;color:#888}
        .pristine-app .save-indicator{font-size:11.5px;display:inline-flex;align-items:center;gap:5px;padding:5px 12px;border-radius:999px;background:#F4F5FB;border:1.5px solid var(--border);color:var(--text-soft);white-space:nowrap}
        .pristine-app .save-indicator.saving{background:var(--amber-light);border-color:#F0D9A8;color:#8A6116}
        .pristine-app .save-indicator.saved{background:var(--green-light);border-color:#A8D9B8;color:var(--green)}.pristine-app .save-indicator.error{background:#FDE8E8;border-color:#D9A8A8;color:#8B1A1A}
        .pristine-app .badge-opcion-pill{cursor:pointer;font-size:11.5px;padding:4px 12px;border-radius:999px;background:#F0F2FA;color:var(--text-soft);border:1.5px solid transparent;user-select:none}
        .pristine-app .badge-opcion-pill:hover{background:var(--navy-light);color:var(--navy)}.pristine-app .badge-opcion-pill.active{background:var(--amber);color:#fff;font-weight:700}
        .pristine-app .badge-confirmada{background:var(--green-light);color:var(--green);font-size:10.5px;font-weight:800;padding:4px 10px;border-radius:999px;border:1.5px solid var(--green)}
        .pristine-app .btn-confirmar{background:var(--green-light);color:var(--green);border:1.5px solid var(--green);padding:4px 12px;border-radius:999px;font-size:11.5px;font-weight:700;cursor:pointer;white-space:nowrap}
        .pristine-app .modulo-operador{border:1.5px solid var(--border);border-radius:12px;padding:16px;margin-bottom:14px}
        .pristine-app .modulo-operador-header{display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:8px;margin-bottom:12px}
        .pristine-app .modulo-op-nombre{font-size:14px;font-weight:800;color:var(--navy)}
        .pristine-app .modulo-montos{display:flex;gap:16px;flex-wrap:wrap;font-size:12.5px;margin-bottom:10px}
        .pristine-app .modulo-monto-item{display:flex;flex-direction:column}.pristine-app .modulo-monto-label{font-size:9.5px;text-transform:uppercase;letter-spacing:.05em;color:var(--text-soft);font-weight:700}
        .pristine-app .modulo-monto-val{font-size:15px;font-weight:800}.pristine-app .modulo-monto-val.deuda{color:var(--navy)}.pristine-app .modulo-monto-val.pagado{color:var(--green)}
        .pristine-app .modulo-monto-val.saldo-ok{color:var(--green)}.pristine-app .modulo-monto-val.saldo-pend{color:var(--amber)}
        .pristine-app .barra-prog-wrap{background:var(--border);border-radius:999px;height:7px;margin:8px 0 12px;overflow:hidden}
        .pristine-app .barra-prog{height:100%;border-radius:999px;background:var(--green);transition:width .3s}
        .pristine-app .tabla-pagos{width:100%;border-collapse:collapse;font-size:12px}
        .pristine-app .tabla-pagos th{text-align:left;font-size:9.5px;text-transform:uppercase;letter-spacing:.05em;color:var(--text-soft);font-weight:700;padding:4px 6px;border-bottom:1.5px solid var(--border);background:var(--navy-light)}
        .pristine-app .tabla-pagos td{padding:5px 6px;border-bottom:1px solid var(--border);vertical-align:middle}
        .pristine-app .consolidado-modulo{background:var(--navy-light);border-radius:10px;padding:14px 16px;display:flex;gap:24px;flex-wrap:wrap}
        .pristine-app .consolidado-item{display:flex;flex-direction:column}.pristine-app .consolidado-label{font-size:9.5px;text-transform:uppercase;letter-spacing:.05em;color:var(--text-soft);font-weight:700}
        .pristine-app .consolidado-val{font-size:18px;font-weight:900}
        .pristine-app .print-only{display:none}
        @media print{.pristine-app .no-print{display:none!important}.pristine-app .print-only{display:block}.pristine-app{background:#fff;padding:0}.pristine-app .card{box-shadow:none;border:1px solid #ccc;break-inside:avoid}.pristine-app .result-card{break-inside:avoid}}
      `}</style>

      {/* HEADER */}
      <div className="card" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
        {logoAgencia
          ? <img src={logoAgencia} alt="Logo" style={{ maxHeight: 42, maxWidth: 200, objectFit: "contain" }} />
          : <span style={{ fontSize: 18, fontWeight: 800, color: "var(--navy)" }}>{datosAgencia.nombre || (usuario && usuario.empresa) || ""}</span>}
        <span className="print-only" style={{ fontSize: 13, color: "var(--text-soft)" }}>
          Cotización confidencial — uso interno · {numeroCotizacion || "sin número asignado"} · Vendedor: {(vendedores.find((v) => v.letra === vendedorLetra) || {}).nombre || vendedorLetra}
        </span>
        <div className="no-print" style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
          {volver && (
            <div>
              <span className="field-label" style={{ marginBottom: 2, visibility: "hidden" }}>&nbsp;</span>
              <button
                onClick={volver}
                style={{ display: "flex", alignItems: "center", gap: 6, background: "transparent", border: "1px solid var(--border)", borderRadius: 6, padding: "7px 14px", cursor: "pointer", fontSize: 13, color: "var(--text-soft)", fontFamily: "inherit", height: 36 }}
              >
                ← Volver
              </button>
            </div>
          )}
          <div>
            <span className="field-label" style={{ marginBottom: 2 }}>Vendedor</span>
            <select
              value={vendedorLetra}
              onChange={(e) => {
                setVendedorLetra(e.target.value);
                setNumeroCotizacion(null);
              }}
              style={{ minWidth: 130 }}
            >
              {vendedores.map((v) => (
                <option key={v.letra} value={v.letra}>
                  {v.nombre} ({v.letra})
                </option>
              ))}
            </select>
          </div>
          <div>
            <span className="field-label" style={{ marginBottom: 2 }}>Nº cotización</span>
            {numeroCotizacion ? (
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span className="opcion-pill" style={{ fontSize: 14, fontWeight: 700 }}>{numeroCotizacion}</span>
                <button className="btn-icon neutral" title="Reasignar número" onClick={liberarNumero}>
                  <ChevronDown size={16} />
                </button>
              </div>
            ) : (
              <button className="btn-primary" onClick={asignarNumero} disabled={!storageReady}>
                Usar {vendedorLetra}-{String(proximoNumero || 1).padStart(4, "0")}
              </button>
            )}
          </div>
          <div>
            <span className="field-label" style={{ marginBottom: 2 }}>Moneda</span>
            <select value={moneda} onChange={(e) => setMoneda(e.target.value)} style={{ minWidth: 150 }}>
              {Object.entries(MONEDAS).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
          </div>
          <button className="btn-secondary" onClick={() => setShowVendedorForm((s) => !s)}>
            <Users size={14} /> Vendedores
          </button>
          <button className="btn-secondary" onClick={() => { setShowPanelCotizaciones((s) => !s); loadCotizaciones(); }}>
            Cotizaciones
          </button>
          <button className="btn-secondary" onClick={() => window.open(window.location.href, "_blank")}>
            Nueva
          </button>
          <button className="btn-secondary" onClick={replicarCotizacion} title="Copia los servicios sin valores para ajustar">
            Replicar
          </button>
          <button className="btn-primary" onClick={() => saveCotizacion(true)}>
            Guardar
          </button>
          <button className="btn-primary" onClick={() => descargarVistaImpresion("interno")}>
            Imprimir / PDF interno
          </button>
          <button className="btn-primary" style={{ background: "var(--amber)" }} onClick={() => descargarVistaImpresion("pasajero")}>
            Enviar al pasajero
          </button>
          <span className={`save-indicator no-print ${guardadoEstado}`}>
            {guardadoEstado === "saving" && "Guardando…"}
            {guardadoEstado === "saved" && "✓ Guardado"}
            {guardadoEstado === "error" && "⚠ Error al guardar"}
            {guardadoEstado === "idle" && ultimoGuardado ? `Guardado ${new Date(ultimoGuardado).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}` : ""}
          </span>
        </div>
      </div>

      {showVendedorForm && (
        <div className="card no-print">
          <div className="section-title"><Users size={14} /> Administrar vendedores</div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
            {vendedores.map((v) => (
              <span key={v.letra} className="tag">{v.nombre} — {v.letra}{v.tel ? ` — ${v.tel}` : ""}</span>
            ))}
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 160 }}>
              <span className="field-label">Nombre</span>
              <input value={nuevoVendedorNombre} onChange={(e) => setNuevoVendedorNombre(e.target.value)} placeholder="Ej: Sofía" />
            </div>
            <div style={{ width: 90 }}>
              <span className="field-label">Inicial</span>
              <input value={nuevoVendedorLetra} onChange={(e) => setNuevoVendedorLetra(e.target.value)} placeholder="S" maxLength={1} />
            </div>
            <div style={{ flex: 1, minWidth: 160 }}>
              <span className="field-label">WhatsApp (con código de país)</span>
              <input value={nuevoVendedorTel} onChange={(e) => setNuevoVendedorTel(e.target.value)} placeholder="Ej: 5491156781234" />
            </div>
            <button className="btn-primary" onClick={addVendedor}><Plus size={14} /> Agregar</button>
          </div>
          <div className="helper-text">La inicial debe ser única y se usará como prefijo de la numeración (ej: S-0001). El número de WhatsApp (sin +, sin espacios) se usa en el botón de contacto del documento para el pasajero.</div>
        </div>
      )}

      {storageWarning && (
        <div className="warning-banner no-print">
          No se pudo guardar o leer la configuración en el servidor (operadores, vendedores, numeración, logo o datos de la agencia). Los cambios pueden no conservarse: recargá la página y revisá tu conexión.
        </div>
      )}

      {/* PANEL COTIZACIONES GUARDADAS */}
      {showPanelCotizaciones && (() => {
        const ESTADOS = ["todos", "En curso", "Enviada", "Aprobada", "Cancelada", "Descartada"];
        const filtradas = cotizaciones.filter((c) => {
          const q = busquedaCot.toLowerCase();
          const matchQ = !q || (c.numero || "").toLowerCase().includes(q) || (c.cliente || "").toLowerCase().includes(q) || (c.destino || "").toLowerCase().includes(q);
          const matchE = filtroEstado === "todos" || c.estado === filtroEstado;
          return matchQ && matchE;
        }).sort((a, b) => {
          const dir = sortCotDir === "asc" ? 1 : -1;
          if (sortCot === "fecha") return dir * (a.fechaActualizacion || "").localeCompare(b.fechaActualizacion || "");
          if (sortCot === "numero") return dir * (a.numero || "").localeCompare(b.numero || "");
          if (sortCot === "cliente") return dir * (a.cliente || "").localeCompare(b.cliente || "");
          return 0;
        });
        function toggleSort(col) {
          if (sortCot === col) setSortCotDir((d) => d === "asc" ? "desc" : "asc");
          else { setSortCot(col); setSortCotDir("desc"); }
        }
        const ESTADO_COLORS = { "En curso": "en-curso", "Enviada": "enviada", "Aprobada": "aprobada", "Cancelada": "cancelada", "Descartada": "descartada" };
        return (
          <div className="card no-print">
            <div className="section-title" style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
              <span>Cotizaciones guardadas ({cotizaciones.length})</span>
              <span style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button className="btn-secondary" onClick={eliminarDescartadas} style={{ fontSize: 12 }}>Eliminar descartadas</button>
                <button className="btn-secondary" onClick={exportarBackup} style={{ fontSize: 12 }}>Exportar backup JSON</button>
              </span>
            </div>
            <div style={{ display: "flex", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
              <input value={busquedaCot} onChange={(e) => setBusquedaCot(e.target.value)} placeholder="Buscar por número, cliente o destino…" style={{ flex: 1, minWidth: 200 }} />
              <select value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)} style={{ width: 150 }}>
                {ESTADOS.map((e) => <option key={e} value={e}>{e === "todos" ? "Todos los estados" : e}</option>)}
              </select>
            </div>
            {filtradas.length === 0 ? (
              <div className="helper-text">No hay cotizaciones que coincidan con la búsqueda.</div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table className="cot-table">
                  <thead>
                    <tr>
                      <th onClick={() => toggleSort("numero")}>Número {sortCot === "numero" ? (sortCotDir === "asc" ? "↑" : "↓") : ""}</th>
                      <th onClick={() => toggleSort("cliente")}>Cliente {sortCot === "cliente" ? (sortCotDir === "asc" ? "↑" : "↓") : ""}</th>
                      <th>Destino</th>
                      <th>Fecha viaje</th>
                      <th onClick={() => toggleSort("fecha")}>Actualización {sortCot === "fecha" ? (sortCotDir === "asc" ? "↑" : "↓") : ""}</th>
                      <th>Estado</th>
                      <th style={{ width: 200 }}>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtradas.map((c) => (
                      <tr key={c.id}>
                        <td style={{ fontWeight: 600 }}>{c.numero || "(sin número)"}</td>
                        <td>{c.cliente || "—"}</td>
                        <td>{c.destino || "—"}</td>
                        <td>{c.fechaViaje || "—"}</td>
                        <td style={{ color: "var(--text-soft)", fontSize: 11.5 }}>{c.fechaActualizacion ? new Date(c.fechaActualizacion).toLocaleString("es-AR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—"}</td>
                        <td>
                          <select className={`badge-estado ${ESTADO_COLORS[c.estado] || "en-curso"}`} value={c.estado} onChange={(e) => cambiarEstadoCot(c.id, e.target.value)} style={{ border: "none", background: "transparent", cursor: "pointer", fontSize: 10.5, fontWeight: 700 }}>
                            {["En curso", "Enviada", "Aprobada", "Cancelada", "Descartada"].map((e) => <option key={e} value={e}>{e}</option>)}
                          </select>
                        </td>
                        <td>
                          <button className="btn-secondary" style={{ fontSize: 11, padding: "4px 9px", marginRight: 6 }} onClick={() => loadCotizacion(c.id)}>Abrir</button>
                          <button className="btn-icon" onClick={() => eliminarCotizacion(c.id, c.estado)}><Trash2 size={14} /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })()}

      {/* DATOS GENERALES */}
      <div className="card">
        <div className="section-title"><Compass size={14} /> Datos generales</div>
        <div className="grid-3">
          <div>
            <span className="field-label">Cliente</span>
            <div style={{ position: "relative" }}>
              <input
                value={cliente}
                onChange={(e) => {
                  setCliente(e.target.value);
                  setClienteIdSeleccionado(null);
                  setClienteBusquedaOpen(true);
                  buscarClientes(e.target.value);
                }}
                onFocus={() => { if (cliente.length >= 2) { setClienteBusquedaOpen(true); buscarClientes(cliente); } }}
                onBlur={() => setTimeout(() => setClienteBusquedaOpen(false), 180)}
                placeholder="Nombre del pasajero"
                style={clienteIdSeleccionado ? { paddingRight: 90 } : {}}
              />
              {/* Badge de estado integrado en el input */}
              {clienteIdSeleccionado && (
                <span
                  style={{
                    position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)",
                    fontSize: 10.5, fontWeight: 700, color: "var(--navy)",
                    background: "var(--bg-soft)", border: "1px solid var(--border)",
                    borderRadius: 4, padding: "2px 6px", cursor: "pointer", userSelect: "none",
                    letterSpacing: ".03em",
                  }}
                  title="Vinculado a la base de datos — clic para desvincular"
                  onClick={() => setClienteIdSeleccionado(null)}
                >
                  ✓ en BD
                </span>
              )}
              {clienteBusquedaOpen && clientesSugeridos.length > 0 && (
                <div className="combo-dropdown" style={{ zIndex: 200 }}>
                  {clientesSugeridos.map((c) => (
                    <div
                      key={c.id}
                      className="combo-option"
                      onMouseDown={(e) => { e.preventDefault(); seleccionarClienteDesdeDB(c); }}
                    >
                      <span style={{ fontWeight: 600 }}>{nombreDisplayCliente(c)}</span>
                      {c.cuit_cuil && <span style={{ fontSize: 11, color: "var(--text-soft)", marginLeft: 6 }}>{c.cuit_cuil}</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
            {/* Helper text sutil debajo del campo */}
            <div style={{ fontSize: 10.5, color: "var(--text-soft)", marginTop: 3 }}>
              {clienteIdSeleccionado
                ? "Vinculado — se guarda automáticamente con la cotización"
                : cliente.trim()
                ? "Se guardará en la base de datos al guardar la cotización"
                : "Tipea para buscar clientes existentes"}
            </div>
          </div>
          <div>
            <span className="field-label">Destino(s) del viaje</span>
            <input value={destino} onChange={(e) => setDestino(e.target.value)} placeholder="Ej: Cancún, México" />
          </div>
          <div>
            <span className="field-label">Fecha de viaje</span>
            <input
              type="text"
              value={fechaViaje}
              onChange={(e) => {
                // Solo números, insertar barras automáticamente
                const digits = e.target.value.replace(/\D/g, "").slice(0, 8);
                let formatted = digits;
                if (digits.length > 4) formatted = digits.slice(0,2) + "/" + digits.slice(2,4) + "/" + digits.slice(4);
                else if (digits.length > 2) formatted = digits.slice(0,2) + "/" + digits.slice(2);
                setFechaViaje(formatted);
              }}
              placeholder="DD/MM/AAAA"
              maxLength={10}
              style={{ letterSpacing: "0.05em" }}
            />
          </div>
          <div>
            <span className="field-label">Cantidad de pasajeros (PAX)</span>
            <input type="number" min="1" value={paxCount} onChange={(e) => setPaxCount(e.target.value)} onFocus={(e) => e.target.select()} />
            {familiasRegistradas.length > 0 && (() => {
              const sumaFamilias = familiasRegistradas.reduce((s, f) => s + (parseFloat(f.pax) || 0), 0);
              const difiere = sumaFamilias !== (parseFloat(paxCount) || 0);
              return difiere ? (
                <div className="helper-text" style={{ color: "var(--amber)", fontWeight: 600 }}>
                  ⚠ No coincide con la suma de pasajeros por familia ({sumaFamilias}). El cálculo usa el desglose por familia, este campo es solo de referencia.
                </div>
              ) : (
                <div className="helper-text">Coincide con la suma de pasajeros por familia.</div>
              );
            })()}
          </div>
          <div>
            <span className="field-label">Estado de la cotización</span>
            <select value={cotEstado} onChange={(e) => { setCotEstado(e.target.value); if (cotId) cambiarEstadoCot(cotId, e.target.value); }}>
              {["En curso", "Enviada", "Aprobada", "Cancelada", "Descartada"].map((e) => <option key={e} value={e}>{e}</option>)}
            </select>
          </div>
          <div>
            <span className="field-label">Vigencia de la cotización</span>
            <input value={vigencia} onChange={(e) => setVigencia(e.target.value)} placeholder="72 horas hábiles" />
          </div>
        </div>

        {familiasRegistradas.length === 0 && (
          <div style={{ marginTop: 14 }}>
            <div className="section-title" style={{ marginBottom: 10 }}>Titular de la reserva</div>
            {/* Fila 1: campos obligatorios */}
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 10 }}>
              <div>
                <span className="field-label">Nombre completo *</span>
                <input value={titularGeneral.nombre} onChange={(e) => setTitularGeneral((t) => ({ ...t, nombre: e.target.value }))} placeholder="Nombre y apellido del titular" />
              </div>
              <div>
                <span className="field-label">DNI *</span>
                <input value={titularGeneral.documento} onChange={(e) => setTitularGeneral((t) => ({ ...t, documento: e.target.value }))} placeholder="Ej: 30123456" />
              </div>
              <div>
                <span className="field-label">WhatsApp * <span style={{ fontWeight: 400 }}>(con cód. de país)</span></span>
                <input value={titularGeneral.tel} onChange={(e) => setTitularGeneral((t) => ({ ...t, tel: e.target.value }))} placeholder="5491156781234" />
              </div>
            </div>
            {/* Fila 2: campos opcionales */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginTop: 8 }}>
              <div>
                <span className="field-label">CUIT / CUIL <span style={{ fontWeight: 400, color: "var(--text-soft)" }}>(opcional)</span></span>
                <input value={titularGeneral.cuit || ""} onChange={(e) => setTitularGeneral((t) => ({ ...t, cuit: e.target.value }))} placeholder="20-30123456-1" />
              </div>
              <div>
                <span className="field-label">Email <span style={{ fontWeight: 400, color: "var(--text-soft)" }}>(opcional)</span></span>
                <input type="email" value={titularGeneral.email || ""} onChange={(e) => setTitularGeneral((t) => ({ ...t, email: e.target.value }))} placeholder="titular@email.com" />
              </div>
              <div>
                <span className="field-label">Localidad <span style={{ fontWeight: 400, color: "var(--text-soft)" }}>(opcional)</span></span>
                <input value={titularGeneral.localidad || ""} onChange={(e) => setTitularGeneral((t) => ({ ...t, localidad: e.target.value }))} placeholder="Ej: Buenos Aires" />
              </div>
            </div>

            {/* Pasajeros adicionales */}
            <div style={{ marginTop: 18 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                <span className="section-title" style={{ margin: 0 }}>Pasajeros</span>
                <span style={{ fontSize: 12, color: "var(--text-soft)", fontWeight: 400 }}>además del titular</span>
              </div>
              {pasajerosLista.length === 0 && (
                <p style={{ fontSize: 12, color: "var(--text-soft)", margin: "0 0 10px" }}>No hay pasajeros cargados todavía.</p>
              )}
              {pasajerosLista.map((pax, idx) => (
                <div key={pax.id} style={{ background: "var(--bg-soft)", borderRadius: 8, padding: "10px 12px", marginBottom: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-soft)" }}>Pasajero {idx + 1}</span>
                    <button className="btn-icon" onClick={() => removePasajero(pax.id)}><Trash2 size={14} /></button>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 8 }}>
                    <div>
                      <span className="field-label">Nombre completo *</span>
                      <input value={pax.nombre} onChange={(e) => updatePasajero(pax.id, "nombre", e.target.value)} placeholder="Nombre y apellido" />
                    </div>
                    <div>
                      <span className="field-label">DNI</span>
                      <input value={pax.documento} onChange={(e) => updatePasajero(pax.id, "documento", e.target.value)} placeholder="Ej: 30123456" />
                    </div>
                    <div>
                      <span className="field-label">WhatsApp <span style={{ fontWeight: 400 }}>(cód. de país)</span></span>
                      <input value={pax.tel} onChange={(e) => updatePasajero(pax.id, "tel", e.target.value)} placeholder="5491156781234" />
                    </div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8, marginTop: 8 }}>
                    <div>
                      <span className="field-label">CUIT / CUIL <span style={{ fontWeight: 400, color: "var(--text-soft)" }}>(opc.)</span></span>
                      <input value={pax.cuit} onChange={(e) => updatePasajero(pax.id, "cuit", e.target.value)} placeholder="20-30123456-1" />
                    </div>
                    <div>
                      <span className="field-label">Email <span style={{ fontWeight: 400, color: "var(--text-soft)" }}>(opc.)</span></span>
                      <input type="email" value={pax.email} onChange={(e) => updatePasajero(pax.id, "email", e.target.value)} placeholder="pax@email.com" />
                    </div>
                    <div>
                      <span className="field-label">Localidad <span style={{ fontWeight: 400, color: "var(--text-soft)" }}>(opc.)</span></span>
                      <input value={pax.localidad} onChange={(e) => updatePasajero(pax.id, "localidad", e.target.value)} placeholder="Ej: Córdoba" />
                    </div>
                    <div>
                      <span className="field-label">Fecha de nac. <span style={{ fontWeight: 400, color: "var(--text-soft)" }}>(opc.)</span></span>
                      <input type="date" value={pax.fechaNac} onChange={(e) => updatePasajero(pax.id, "fechaNac", e.target.value)} />
                    </div>
                  </div>
                </div>
              ))}
              <button className="btn-secondary" style={{ marginTop: 4 }} onClick={addPasajero}>
                <Plus size={13} /> Agregar pasajero
              </button>
            </div>
          </div>
        )}
        <div style={{ marginTop: 14 }} className="no-print">
          <button className="btn-secondary" onClick={() => setShowDatosPrograma((s) => !s)}>
            {showDatosPrograma ? <ChevronUp size={14} /> : <ChevronDown size={14} />} Datos del programa (opcional, para el documento)
          </button>
        </div>
        {showDatosPrograma && (
          <div className="grid-2" style={{ marginTop: 14 }}>
            <div>
              <span className="field-label">Título del programa</span>
              <input value={tituloPrograma} onChange={(e) => setTituloPrograma(e.target.value)} placeholder="Ej: México 2026" />
            </div>
            <div>
              <span className="field-label">Duración</span>
              <input value={duracionPrograma} onChange={(e) => setDuracionPrograma(e.target.value)} placeholder="Ej: 8 días / 7 noches" />
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <span className="field-label">Detalle de vuelos (pegar tal cual desde Amadeus)</span>
              <textarea
                value={detalleVuelos}
                onChange={(e) => setDetalleVuelos(e.target.value)}
                rows={5}
                style={{ fontFamily: "ui-monospace, Menlo, Consolas, monospace", fontSize: 12.5 }}
              />
            </div>
          </div>
        )}
      </div>

      {/* FAMILIAS */}
      <div className="card no-print">
        <div className="section-title"><Users size={14} /> Familias / grupos de pasajeros</div>
        <div className="helper-text" style={{ marginBottom: 10 }}>
          Si en esta cotización viajan varias familias con presupuesto separado, declarálas acá antes de cargar los ítems (no hay límite de cantidad). Después, en cada ítem vas a poder elegir a cuál pertenece desde una lista. Los ítems que dejes como "Compartido" se reparten entre todas en proporción a esta cantidad de pax, incluyendo el gasto de reserva del operador (que se cobra una sola vez por el viaje completo). Si no cargás ninguna familia acá, la cotización funciona como siempre, con un solo presupuesto.
        </div>
        {familiasRegistradas.map((f) => (
          <div key={f.id} style={{ border: "1.5px solid var(--border)", borderRadius: 10, padding: "14px 16px", marginBottom: 10 }}>
            <div style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap", marginBottom: 10 }}>
              <div style={{ flex: 2, minWidth: 180 }}>
                <span className="field-label">Apellido / nombre de familia</span>
                <input value={f.nombre} onChange={(e) => updateFamiliaNombre(f.id, e.target.value)} placeholder="Ej: Familia López" />
              </div>
              <div style={{ display: "flex", gap: 6, alignItems: "flex-end" }}>
                <div style={{ width: 64 }}>
                  <span className="field-label">ADT</span>
                  <input type="number" min="0" value={f.adt ?? 1} onChange={(e) => updateFamiliaAdt(f.id, e.target.value)} onFocus={(e) => e.target.select()} />
                </div>
                <div style={{ width: 64 }}>
                  <span className="field-label">CHD</span>
                  <input type="number" min="0" value={f.chd ?? 0} onChange={(e) => updateFamiliaChd(f.id, e.target.value)} onFocus={(e) => e.target.select()} />
                </div>
                <div style={{ width: 64 }}>
                  <span className="field-label">INF</span>
                  <input type="number" min="0" value={f.inf ?? 0} onChange={(e) => updateFamiliaInf(f.id, e.target.value)} onFocus={(e) => e.target.select()} />
                </div>
                <div style={{ width: 64 }}>
                  <span className="field-label">Total pax</span>
                  <input type="number" value={f.pax} readOnly style={{ background: "var(--bg-soft)", color: "var(--text-soft)", cursor: "default" }} />
                </div>
              </div>
              <button className="btn-icon" onClick={() => removeFamilia(f.id)}><Trash2 size={15} /></button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 10, marginTop: 8 }}>
              <div>
                <span className="field-label">Titular de la reserva</span>
                <input value={f.titular || ""} onChange={(e) => updateFamiliaCampo(f.id, "titular", e.target.value)} placeholder="Nombre completo del titular" />
              </div>
              <div>
                <span className="field-label">DNI / Documento</span>
                <input value={f.documento || ""} onChange={(e) => updateFamiliaCampo(f.id, "documento", e.target.value)} placeholder="Ej: 30123456" />
              </div>
              <div>
                <span className="field-label">WhatsApp (con cód. de país)</span>
                <input value={f.tel || ""} onChange={(e) => updateFamiliaCampo(f.id, "tel", e.target.value)} placeholder="5491156781234" />
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginTop: 8 }}>
              <div>
                <span className="field-label">CUIT / CUIL <span style={{ fontWeight: 400, color: "var(--text-soft)" }}>(opcional)</span></span>
                <input value={f.cuit || ""} onChange={(e) => updateFamiliaCampo(f.id, "cuit", e.target.value)} placeholder="20-30123456-1" />
              </div>
              <div>
                <span className="field-label">Email <span style={{ fontWeight: 400, color: "var(--text-soft)" }}>(opcional)</span></span>
                <input type="email" value={f.email || ""} onChange={(e) => updateFamiliaCampo(f.id, "email", e.target.value)} placeholder="titular@email.com" />
              </div>
              <div>
                <span className="field-label">Localidad <span style={{ fontWeight: 400, color: "var(--text-soft)" }}>(opcional)</span></span>
                <input value={f.localidad || ""} onChange={(e) => updateFamiliaCampo(f.id, "localidad", e.target.value)} placeholder="Ej: Buenos Aires" />
              </div>
            </div>
          </div>
        ))}
        <button className="btn-primary" onClick={addFamilia}><Plus size={14} /> Agregar familia</button>
      </div>

      {/* LOGO Y DATOS DE LA AGENCIA */}
      <div className="card no-print">
        <div className="section-title" style={{ marginBottom: 10 }}>
          Logo de la agencia
          <span style={{ fontSize: 11, color: "#6470A0", fontWeight: 400, marginLeft: 8 }}>
            Aparece en los documentos al pasajero y en la liquidación
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          {logoAgencia ? (
            <>
              <img
                src={logoAgencia}
                alt="Logo agencia"
                style={{ maxHeight: 50, maxWidth: 200, objectFit: "contain", border: "1px solid #E1E3EE", borderRadius: 6, padding: 6, background: "#fff" }}
              />
              <button
                className="btn-small"
                style={{ background: "#FEE2E2", color: "#DC2626", border: "none", borderRadius: 6, padding: "6px 14px", cursor: "pointer", fontSize: 12, fontWeight: 600 }}
                onClick={eliminarLogoAgencia}
              >
                Eliminar logo
              </button>
            </>
          ) : (
            <span style={{ fontSize: 12, color: "#9CA3AF" }}>Sin logo configurado — en los documentos se muestra el nombre de la agencia</span>
          )}
          <label style={{ display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer", background: "#1B3A8C", color: "#fff", borderRadius: 6, padding: "7px 14px", fontSize: 12, fontWeight: 600 }}>
            {logoAgencia ? "Cambiar logo" : "Subir logo"}
            <input
              type="file"
              accept="image/png,image/jpeg,image/svg+xml,image/webp"
              style={{ display: "none" }}
              onChange={(e) => {
                const file = e.target.files[0];
                if (!file) return;
                if (file.size > 300 * 1024) { alert("El logo no debe superar 300 KB."); return; }
                const reader = new FileReader();
                reader.onload = (ev) => persistLogoAgencia(ev.target.result);
                reader.readAsDataURL(file);
                e.target.value = "";
              }}
            />
          </label>
          <span style={{ fontSize: 11, color: "#9CA3AF" }}>PNG, JPG o SVG · máx. 300 KB</span>
        </div>
      </div>

      <div className="card no-print">
        <div className="section-title" style={{ cursor: "pointer", userSelect: "none" }} onClick={() => setShowDatosAgencia((s) => !s)}>
          Datos de la agencia
          <span style={{ fontSize: 11, color: "#6470A0", fontWeight: 400, marginLeft: 8 }}>
            Aparecen en el pie del documento al pasajero y la liquidación
          </span>
          <span className="toggle" style={{ marginLeft: "auto" }}>
            {showDatosAgencia ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </span>
        </div>
        {!showDatosAgencia && datosAgencia.nombre && (
          <div style={{ fontSize: 12, color: "#6470A0", marginTop: 4 }}>
            {datosAgencia.nombre}{datosAgencia.telefono ? ` · ${datosAgencia.telefono}` : ""}{datosAgencia.email ? ` · ${datosAgencia.email}` : ""}
          </div>
        )}
        {showDatosAgencia && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 12 }}>
              {[
                ["nombre",    "Nombre de la agencia", "Agencia de Viajes S.A."],
                ["direccion", "Dirección",             "Av. Corrientes 1234, Buenos Aires"],
                ["telefono",  "Teléfono",              "+54 11 1234-5678"],
                ["email",     "Email",                 "info@agencia.com"],
                ["web",       "Sitio web",             "www.agencia.com"],
                ["eslogan",   "Eslogan (opcional)",    "Tu eslogan"],
                ["leyenda",   "Leyenda al pie del documento al pasajero (opcional)", "Ej: Legajo 0000 · Años de trayectoria"],
              ].map(([campo, label, placeholder]) => (
                <div key={campo} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <span className="field-label" style={{ marginBottom: 2 }}>{label}</span>
                  <input
                    className="input-field"
                    value={datosAgencia[campo] || ""}
                    placeholder={placeholder}
                    onChange={(e) => persistDatosAgencia({ ...datosAgencia, [campo]: e.target.value })}
                  />
                </div>
              ))}
            </div>
            <div style={{ marginTop: 10, fontSize: 11, color: "#9CA3AF" }}>
              Se guardan automáticamente al escribir.
            </div>
          </>
        )}
      </div>

      {/* OPERADORES */}
      <div className="card no-print">
        <div className="section-title">
          <Settings2 size={14} /> Operadores
          <span className="toggle" onClick={() => setShowOperadores((s) => !s)}>
            {showOperadores ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </span>
        </div>
        {!showOperadores && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {operadores.map((o) => (
              <span key={o.id} className="tag">{o.nombre} · {o.gastoOperador}% gastos</span>
            ))}
          </div>
        )}
        {showOperadores && (
          <div>
            <div style={{ overflowX: "auto" }}>
            <table className="items" style={{ minWidth: 760 }}>
              <thead>
                <tr>
                  <th>Operador</th>
                  <th style={{ width: 130 }}>% Gastos op.</th>
                  <th style={{ width: 130 }}>Gasto reserva</th>
                  <th style={{ width: 130 }}>Fee emisión</th>
                  <th style={{ width: 130 }}>% Comisión otorgada</th>
                  <th style={{ width: 40 }}></th>
                </tr>
              </thead>
              <tbody>
                {operadores.map((o) => (
                  <tr key={o.id}>
                    <td>
                      <input value={o.nombre} onChange={(e) => updateOperador(o.id, "nombre", e.target.value)} />
                    </td>
                    <td>
                      <input type="number" value={o.gastoOperador} onChange={(e) => updateOperador(o.id, "gastoOperador", parseFloat(e.target.value) || 0)}  onFocus={(e) => e.target.select()} />
                    </td>
                    <td>
                      <ImporteInput value={o.gastoReserva} onChange={(v) => updateOperador(o.id, "gastoReserva", v)} />
                    </td>
                    <td>
                      <input type="number" value={o.feeEmision} onChange={(e) => updateOperador(o.id, "feeEmision", parseFloat(e.target.value) || 0)}  onFocus={(e) => e.target.select()} />
                    </td>
                    <td>
                      <input type="number" value={o.pctComision} onChange={(e) => updateOperador(o.id, "pctComision", parseFloat(e.target.value) || 0)}  onFocus={(e) => e.target.select()} />
                    </td>
                    <td>
                      <button className="btn-icon" onClick={() => removeOperador(o.id)}><Trash2 size={15} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
            <div style={{ display: "flex", gap: 10, alignItems: "flex-end", marginTop: 12, flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: 160 }}>
                <span className="field-label">Nuevo operador</span>
                <input value={nuevoOpNombre} onChange={(e) => setNuevoOpNombre(e.target.value)} placeholder="Ej: Despegar" />
              </div>
              <div style={{ width: 120 }}>
                <span className="field-label">% Gastos op.</span>
                <input type="number" value={nuevoOpPctGasto} onChange={(e) => setNuevoOpPctGasto(e.target.value)} placeholder="0"  onFocus={(e) => e.target.select()} />
              </div>
              <div style={{ width: 120 }}>
                <span className="field-label">Gasto reserva</span>
                <input type="number" value={nuevoOpReserva} onChange={(e) => setNuevoOpReserva(e.target.value)} placeholder="0"  onFocus={(e) => e.target.select()} />
              </div>
              <div style={{ width: 120 }}>
                <span className="field-label">Fee emisión</span>
                <input type="number" value={nuevoOpFeeEmision} onChange={(e) => setNuevoOpFeeEmision(e.target.value)} placeholder="0"  onFocus={(e) => e.target.select()} />
              </div>
              <div style={{ width: 130 }}>
                <span className="field-label">% Comisión otorgada</span>
                <input type="number" value={nuevoOpPctComision} onChange={(e) => setNuevoOpPctComision(e.target.value)} placeholder="0"  onFocus={(e) => e.target.select()} />
              </div>
              <button className="btn-primary" onClick={addOperador}><Plus size={14} /> Agregar</button>
            </div>
            <div className="helper-text">
              Gasto de reserva: monto fijo, se cobra una sola vez por operador dentro de cada opción. Fee de emisión: monto fijo por emisión y por pasajero, se aplica en los ítems donde tildes "Aplica fee emisión". Esta lista se comparte entre todos los que usan el cotizador.
            </div>
          </div>
        )}
      </div>

      {/* ITEMS */}
      <div className="card no-print">
        <div className="section-title"><Receipt size={14} /> Ítems del programa</div>
        <div className="helper-text" style={{ marginBottom: 12 }}>
          "Destino" es un buscador: empezá a escribir y te va a mostrar los que ya existen (sin importar acentos, "cancun" encuentra "Cancún"). Si lo que buscás no existe todavía, aparece la opción "+ Crear..." para darlo de alta una sola vez. "Familia" es un campo de texto libre (vacío = compartido entre todas) — prestá atención a escribir el mismo nombre exacto en los ítems de una misma familia, ya que acá no hay sugerencias. El casillero "(cargar valor por persona)" debajo del Valor operador indica si ese número es por pasajero (se multiplica solo por la cantidad correspondiente) o un total fijo (no se multiplica) — viene tildado por defecto en Aéreo, Hotel, Todo incluido, Asistencia, Excursión, Crucero, Seguro, Entrada, Tren, Ferry y Guía; en Auto y Traslado queda sin tildar, a tu criterio en cada caso.
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap", marginBottom: 14, padding: "12px 14px", background: "#FAFAFD", border: "1px solid var(--border)", borderRadius: 8 }}>
          <div style={{ width: 160 }}>
            <span className="field-label">Tipo de habitación</span>
            <select value={bulkTipoHabitacion} onChange={(e) => setBulkTipoHabitacion(e.target.value)}>
              <option value="">Sin cambio</option>
              {TIPOS_HABITACION.map((v) => (
                <option key={v} value={v}>{v}</option>
              ))}
            </select>
          </div>
          <div style={{ width: 160 }}>
            <span className="field-label">Régimen</span>
            <select value={bulkRegimen} onChange={(e) => setBulkRegimen(e.target.value)}>
              <option value="">Sin cambio</option>
              {REGIMENES.map((v) => (
                <option key={v} value={v}>{v}</option>
              ))}
            </select>
          </div>
          <button
            className={bulkTipoHabitacion || bulkRegimen ? "btn-primary" : "btn-secondary"}
            onClick={aplicarTipoYRegimenATodos}
          >
            Aplicar mismo tipo de habitación y régimen para todos los hoteles
          </button>
          <span className="helper-text" style={{ marginTop: 0 }}>Mientras estos selectores tengan un valor (botón resaltado en azul), todo hotel nuevo que agregues va a nacer con ese tipo de habitación y régimen. El botón además aplica el cambio de una sola vez a los hoteles ya cargados. Volvé ambos a "Sin cambio" para desactivar el valor por defecto.</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
          {items.map((it) => {
            const c = calcItem(it, paxParaItem(it));
            return (
              <div key={it.id} style={{ border: "1.5px solid var(--border)", borderRadius: 10 }}>

                {/* NIVEL 1: Categoría + Descripción */}
                <div style={{ display: "flex", gap: 0, background: "var(--navy-light)", borderBottom: "1.5px solid var(--border)", borderRadius: "8px 8px 0 0", overflow: "visible" }}>
                  <div style={{ width: 160, flexShrink: 0, padding: "8px 10px", borderRight: "1.5px solid var(--border)" }}>
                    <select value={it.categoria} onChange={(e) => handleCategoriaChange(it.id, e.target.value)} style={{ fontSize: 13, width: "100%" }}>
                      <option value="">Seleccionar…</option>
                      {CATEGORIAS.map((cat) => (
                        <option key={cat.id} value={cat.id}>{cat.label}</option>
                      ))}
                    </select>
                  </div>
                  <div style={{ flex: 1, padding: "8px 10px", display: "flex", flexDirection: "column", gap: 5 }}>
                    <textarea
                      value={it.descripcion}
                      onChange={(e) => updateItem(it.id, "descripcion", e.target.value)}
                      rows={2}
                      style={{ resize: "vertical", width: "100%", fontSize: 13, fontWeight: 500 }}
                      placeholder="Descripción del servicio…"
                    />
                    {!it.descripcionAuto && it.categoria && (
                      <span className="auto-tag" onClick={() => regenerarDescripcion(it.id)}>
                        <RotateCcw size={11} /> Regenerar texto sugerido
                      </span>
                    )}
                    {/* Campos estructurados */}
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
                      {(it.categoria === "hotel" || it.categoria === "todoincluido") && <>
                        <SinglePillGroup value={it.tipoHabitacion} options={TIPOS_HABITACION} onChange={(v) => updateItemStructured(it.id, "tipoHabitacion", v)} />
                        <SinglePillGroup value={it.regimen} options={REGIMENES} onChange={(v) => updateItemStructured(it.id, "regimen", v)} />
                      </>}
                      {["aereo","tren","ferry","crucero"].includes(it.categoria) && <>
                        <label className="checkbox-pill"><input type="checkbox" checked={it.incluyeMochila} onChange={(e) => updateItemStructured(it.id, "incluyeMochila", e.target.checked)} />Mochila</label>
                        <label className="checkbox-pill"><input type="checkbox" checked={it.incluyeCarryOn} onChange={(e) => updateItemStructured(it.id, "incluyeCarryOn", e.target.checked)} />Carry-on</label>
                        <label className="checkbox-pill"><input type="checkbox" checked={it.incluyeBodega} onChange={(e) => updateItemStructured(it.id, "incluyeBodega", e.target.checked)} />Bodega</label>
                        <SinglePillGroup value={it.tipoVuelo} options={TIPOS_VUELO} onChange={(v) => updateItemStructured(it.id, "tipoVuelo", v)} />
                      </>}
                      {["aereo","hotel","todoincluido","traslado","asistencia","entrada","crucero","tren","ferry"].includes(it.categoria) && <>
                        <label className="checkbox-pill" style={{ background: it.tarifasMixtas ? "var(--navy)" : undefined, color: it.tarifasMixtas ? "#fff" : undefined }}>
                          <input type="checkbox" checked={it.tarifasMixtas} onChange={(e) => toggleTarifasMixtas(it.id, e.target.checked)} />
                          Tarifas diferenciadas (ADT/CHD/INF)
                        </label>
                      </>}
                      {it.categoria === "traslado" && <SinglePillGroup value={it.tipoServicio} options={TIPOS_SERVICIO_TRASLADO} onChange={(v) => updateItemStructured(it.id, "tipoServicio", v)} />}
                      {it.categoria === "auto" && <>
                        <SinglePillGroup value={it.categoriaAuto} options={CATEGORIAS_AUTO} onChange={(v) => updateItemStructured(it.id, "categoriaAuto", v)} />
                        <SinglePillGroup value={it.seguroAuto} options={SEGUROS_AUTO} onChange={(v) => updateItemStructured(it.id, "seguroAuto", v)} />
                      </>}
                      {it.categoria === "crucero" && <SinglePillGroup value={it.tipoCabina} options={TIPOS_CABINA} onChange={(v) => updateItemStructured(it.id, "tipoCabina", v)} />}
                      {it.categoria === "asistencia" && <SinglePillGroup value={it.nivelCobertura} options={NIVELES_COBERTURA} onChange={(v) => updateItemStructured(it.id, "nivelCobertura", v)} />}
                    </div>
                  </div>
                </div>

                {/* NIVEL 2: todos los campos en una sola línea fija */}
                <div style={{ display: "flex", gap: 10, padding: "10px", background: "#fff", alignItems: "flex-end", overflowX: "auto", flexWrap: "nowrap" }}>
                  <FL label={["auto","asistencia","entrada","wifi","guia","ferry"].includes(it.categoria) ? "Días" : "Noches"}>
                    <input type="number" min="0" value={it.noches} onChange={(e) => updateItemStructured(it.id, "noches", e.target.value)} placeholder="—" style={{ width: 56 }}  onFocus={(e) => e.target.select()} />
                  </FL>
                  <FL label="Operador">
                    <select value={it.operadorId} onChange={(e) => handleOperadorChange(it.id, e.target.value)} style={{ width: 140 }}>
                      <option value="">Seleccionar…</option>
                      {operadores.map((o) => <option key={o.id} value={o.id}>{o.nombre}</option>)}
                    </select>
                  </FL>
                  {it.tarifasMixtas ? (
                    <FL label="Tarifas por tipo de pasajero">
                      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        {(it.tramos || []).map((t) => (
                          <div key={t.id} style={{ display: "flex", gap: 4, alignItems: "center" }}>
                            <select value={t.tipo} onChange={(e) => updateTramo(it.id, t.id, "tipo", e.target.value)} style={{ width: 64, fontSize: 11, padding: "3px 18px 3px 4px" }}>
                              <option value="ADT">ADT</option>
                              <option value="CHD">CHD</option>
                              <option value="INF">INF</option>
                            </select>
                            <input type="number" min="0" value={t.cantidad} onChange={(e) => updateTramo(it.id, t.id, "cantidad", e.target.value)} placeholder="Cant." style={{ width: 48, fontSize: 11 }} title="Cantidad de pasajeros"  onFocus={(e) => e.target.select()} />
                            <span style={{ fontSize: 11, color: "var(--text-soft)" }}>×</span>
                            <ImporteInput value={t.valor} onChange={(v) => updateTramo(it.id, t.id, "valor", v)} style={{ width: 100, fontSize: 11 }} />
                            <button className="btn-icon" style={{ padding: 2 }} onClick={() => removeTramo(it.id, t.id)}><Trash2 size={11} /></button>
                          </div>
                        ))}
                        <button className="btn-secondary" style={{ fontSize: 10.5, padding: "2px 8px", width: "fit-content" }} onClick={() => addTramo(it.id)}><Plus size={10} /> Agregar tarifa</button>
                        <span style={{ fontSize: 10.5, color: "var(--navy)", fontWeight: 700 }}>Total: {fmt(c.bruto)}</span>
                      </div>
                    </FL>
                  ) : (
                    <FL label="Valor operador">
                      {it.tarifasMixtas ? (
                        <div className="readonly-cell" style={{ minWidth: 100, textAlign: "right", fontWeight: 600 }}>
                          {fmt(it.tramos ? it.tramos.reduce((s, t) => s + (parseFloat(t.cantidad) || 0) * (parseFloat(t.valor) || 0), 0) : 0)}
                          <span style={{ fontSize: 10, color: "var(--text-soft)", marginLeft: 4 }}>total</span>
                        </div>
                      ) : (
                        <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
                          <ImporteInput value={it.bruto} onChange={(v) => updateItem(it.id, "bruto", v)} style={{ width: 120 }} />
                          <label className="checkbox-pill" style={{ fontSize: 11, whiteSpace: "nowrap" }}>
                            <input type="checkbox" checked={it.valorPorPersona} onChange={(e) => updateItem(it.id, "valorPorPersona", e.target.checked)} />
                            x pax
                          </label>
                        </div>
                      )}
                    </FL>
                  )}
                  <FL label="% Comisión">
                    <input type="number" value={it.pctComision} onChange={(e) => updateItem(it.id, "pctComision", e.target.value)} placeholder="0" style={{ width: 64 }}  onFocus={(e) => e.target.select()} />
                  </FL>
                  <FL label="Comisión">
                    <div className="readonly-cell">{fmt(c.comision)}</div>
                  </FL>
                  <FL label="Imp. fijos">
                    <ImporteInput value={it.impuestosFijos||""} onChange={(v) => updateItem(it.id, "impuestosFijos", v)} style={{ width: 110 }} />
                  </FL>
                  <FL label="Neto">
                    <div className="readonly-cell">{fmt(c.neto)}</div>
                  </FL>
                  <FL label="% G. Operador">
                    <input type="number" value={it.pctGastoOperador} onChange={(e) => updateItem(it.id, "pctGastoOperador", e.target.value)} placeholder="0" style={{ width: 64 }}  onFocus={(e) => e.target.select()} />
                  </FL>
                  <FL label="G. Op. calc.">
                    <div className="readonly-cell" style={{ color: it.gastoOperadorManual ? "var(--text-soft)" : undefined }}>{fmt(c.gastoOperadorCalculado)}</div>
                  </FL>
                  <FL label="G. Op. manual">
                    <ImporteInput value={it.gastoOperadorManual||""} onChange={(v) => updateItem(it.id, "gastoOperadorManual", v)} style={{ width: 110 }} placeholder="Auto" />
                  </FL>
                  <FL label="G. Operador">
                    <div className="readonly-cell" style={{ fontWeight: 700 }}>{fmt(c.gastoOperador)}</div>
                  </FL>
                  <FL label="Fee emisión">
                    <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
                      <label className="checkbox-pill" style={{ fontSize: 11, whiteSpace: "nowrap" }}>
                        <input type="checkbox" checked={it.aplicaFeeEmision} onChange={(e) => updateItem(it.id, "aplicaFeeEmision", e.target.checked)} />
                        Aplica
                      </label>
                      <input
                        type="number"
                        value={it.feeEmision}
                        onChange={(e) => updateItem(it.id, "feeEmision", e.target.value)}
                        placeholder="0"
                        disabled={!it.aplicaFeeEmision}
                        style={{ width: 80, opacity: it.aplicaFeeEmision ? 1 : 0.35, pointerEvents: it.aplicaFeeEmision ? "auto" : "none" }}
                      />
                    </div>
                  </FL>
                  <FL label="Destino">
                    <div style={{ width: 130 }}>
                      <ComboField value={it.destino} options={destinos} createLabel="Crear destino" onSelect={(v) => updateItem(it.id, "destino", v)} />
                    </div>
                  </FL>
                  <FL label="Familia">
                    <select value={it.familiaId} onChange={(e) => updateItem(it.id, "familiaId", e.target.value)} style={{ width: 130 }}>
                      <option value="">Compartido</option>
                      {familiasRegistradas.map((f) => <option key={f.id} value={f.id}>{f.nombre || "(sin nombre)"}</option>)}
                    </select>
                  </FL>
                  <FL label="&nbsp;">
                    <div style={{ display: "flex", gap: 4 }}>
                      <button className="btn-icon neutral" title="Duplicar ítem" onClick={() => duplicateItem(it.id)}><Copy size={14} /></button>
                      <button className="btn-icon" title="Eliminar ítem" onClick={() => removeItem(it.id)}><Trash2 size={14} /></button>
                    </div>
                  </FL>
                </div>


              </div>
            );
          })}
        </div>
        
        <div style={{ marginTop: 14 }}>
          <button className="btn-primary" onClick={addItem}><Plus size={14} /> Agregar ítem</button>
        </div>
      </div>

      {/* OPCIONES */}
      {hotelesSinDestino.length > 0 && (
        <div className="warning-banner no-print">
          Tenés {hotelesSinDestino.length === 1 ? "un hotel" : `${hotelesSinDestino.length} hoteles`} sin destino asignado ({hotelesSinDestino.map((it) => shortLabel(it)).join(", ")}). Como están "Compartidos", se van a sumar a todas las Opciones. Si no es lo que querés, asignales un destino en la tabla de Ítems.
        </div>
      )}
      {true && (
        <div className="card no-print">
          <div className="section-title"><Layers size={14} /> Opciones</div>
          <div className="helper-text" style={{ marginBottom: 10 }}>
            {familiasRegistradas.length > 0
              ? "Por cada Opción y cada destino, elegí qué ítem corresponde a cada familia. Los ítems sin destino (Compartido) se suman solos a todas las Opciones."
              : "Por cada Opción, elegí qué ítem usar en cada destino detectado. Los ítems sin destino (Compartido) se suman solos a todas las Opciones."}
          </div>
          {opciones.map((o) => (
            <div className="opcion-row" key={o.id}>
              <input
                value={o.nombre}
                onChange={(e) => updateOpcionNombre(o.id, e.target.value)}
                style={{ maxWidth: 200, fontWeight: 600 }}
              />
              {destinos.map((d) =>
                familiasRegistradas.length > 0 ? (
                  <div key={d} style={{ display: "flex", flexDirection: "column", gap: 6, border: "1px solid var(--border)", borderRadius: 8, padding: "8px 10px" }}>
                    <span className="field-label" style={{ marginBottom: 0 }}>{d}</span>
                    {familiasRegistradas.map((fam) => {
                      const candidatos = itemsDeDestino(d).filter((it) => !it.familiaId || it.familiaId === fam.id);
                      const selFamilia = (o.selecciones[d] && typeof o.selecciones[d] === "object") ? o.selecciones[d][fam.id] : "";
                      return (
                        <div key={fam.id} style={{ minWidth: 190 }}>
                          <span className="field-label" style={{ marginBottom: 2, fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>{fam.nombre || "(sin nombre)"}</span>
                          <select value={selFamilia || ""} onChange={(e) => updateOpcionSeleccionFamilia(o.id, d, fam.id, e.target.value)}>
                            <option value="">Elegir…</option>
                            {candidatos.map((it) => {
                              const adt = parseInt(fam.adt)||0;
                              const chd = parseInt(fam.chd)||0;
                              const inf = parseInt(fam.inf)||0;
                              let totalIt = 0;
                              if (it.tarifasMixtas && Array.isArray(it.tramos)) {
                                it.tramos.forEach(t => {
                                  const cant = t.tipo === "ADT" ? adt : t.tipo === "CHD" ? chd : t.tipo === "INF" ? inf : parseFloat(t.cantidad)||0;
                                  totalIt += (parseFloat(t.bruto)||0) * cant;
                                });
                              } else {
                                totalIt = (parseFloat(it.bruto)||0) * (adt + chd + inf || 1);
                              }
                              return (
                                <option key={it.id} value={it.id}>
                                  {(it.descripcion || "(sin descripción)").slice(0, 35)} [{fam.nombre||"flia"}] — {fmt(totalIt)}
                                </option>
                              );
                            })}
                          </select>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div key={d} style={{ minWidth: 190 }}>
                    <span className="field-label" style={{ marginBottom: 2 }}>{d}</span>
                    <select value={o.selecciones[d] || ""} onChange={(e) => updateOpcionSeleccion(o.id, d, e.target.value)}>
                      <option value="">Elegir…</option>
                      {itemsDeDestino(d).map((it) => (
                        <option key={it.id} value={it.id}>
                          {(it.descripcion || "(sin descripción)").slice(0, 40)} — {fmt(parseFloat(it.bruto) || 0)}
                        </option>
                      ))}
                    </select>
                  </div>
                )
              )}
              <button className="btn-icon" style={{ marginLeft: "auto" }} onClick={() => removeOpcion(o.id)}><Trash2 size={15} /></button>
            </div>
          ))}
          <div style={{ marginTop: 14, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <button className="btn-primary" onClick={addOpcion}><Plus size={14} /> Agregar opción</button>
            <label style={{ display: "inline-flex", alignItems: "center", gap: 8, cursor: "pointer", padding: "8px 14px", borderRadius: 8, background: modoSumaDirecta ? "var(--amber-light)" : "var(--navy-light)", border: `1.5px solid ${modoSumaDirecta ? "var(--amber)" : "var(--border)"}` }}>
              <input type="checkbox" checked={modoSumaDirecta} onChange={(e) => {
                const checked = e.target.checked;
                setModoSumaDirecta(checked);
                if (!checked) {
                  setOpcionesConfirmadasPorFamilia({});
                }
              }} style={{ width: "auto", cursor: "pointer" }} />
              <span style={{ fontSize: 13, fontWeight: 600, color: modoSumaDirecta ? "var(--amber)" : "var(--navy)" }}>
                Sin comparar opciones — sumar todo directamente
              </span>
            </label>
          </div>
        </div>
      )}

      {/* PARA EL DOCUMENTO DEL PASAJERO */}
      <div className="card no-print">
        <div className="section-title">Documento para el pasajero</div>
        <div>
          <span className="field-label">Texto de introducción personalizado</span>
          <textarea value={textoIntro} onChange={(e) => setTextoIntro(e.target.value)} rows={4} placeholder="Ej: Hola Alicia! Te armé la propuesta completa para que puedas comparar con tranquilidad…" />
          <div className="helper-text">Este texto aparece al comienzo del documento del pasajero, antes de los servicios y precios.</div>
        </div>
        {opciones.length > 0 && !modoSumaDirecta && (
          <div style={{ marginTop: 14 }}>
            <span className="field-label" style={{ display: "block", marginBottom: 8 }}>Badge y descripción por opción</span>
            {opciones.map((o) => (
              <div key={o.id} style={{ border: "1px solid var(--border)", borderRadius: 10, padding: "12px 14px", marginBottom: 10 }}>
                <div style={{ fontWeight: 700, marginBottom: 8, fontSize: 13 }}>{o.nombre || "Opción"}</div>
                <div className="badge-opcion-select">
                  {["Nuestra recomendación", "Opción premium", "Mejor precio"].map((b) => (
                    <span key={b} className={`badge-opcion-pill${opcionesBadge[o.id] === b ? " active" : ""}`} onClick={() => setOpcionesBadge((prev) => ({ ...prev, [o.id]: prev[o.id] === b ? "" : b }))}>
                      {b}
                    </span>
                  ))}
                </div>
                <textarea value={opcionesTexto[o.id] || ""} onChange={(e) => setOpcionesTexto((prev) => ({ ...prev, [o.id]: e.target.value }))} rows={2} placeholder="Descripción comercial de esta opción (opcional)…" style={{ marginTop: 8, fontSize: 12.5 }} />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* FEE PRISTINE */}
      <div className="card no-print">
        <div className="section-title">Fee Pristine</div>
        <div style={{ display: "flex", gap: 14, alignItems: "flex-end", flexWrap: "wrap" }}>
          <div style={{ width: 220 }}>
            <span className="field-label">Importe del fee (por pasajero)</span>
            <input type="number" value={feePristine} onChange={(e) => setFeePristine(e.target.value)} placeholder="0"  onFocus={(e) => e.target.select()} />
          </div>
          <div className="helper-text" style={{ marginBottom: 8 }}>
            {familiasRegistradas.length > 0
              ? "Se multiplica por la cantidad de pasajeros de cada familia (ver panel Familias) y se suma al total bruto y a la ganancia comisionable de cada una."
              : `Se multiplica por la cantidad de pasajeros (${paxCount || 1}) y luego se suma al total bruto y a la ganancia comisionable de cada resultado.`}
          </div>
        </div>
      </div>

      {/* RESULTADOS */}
      {destinos.length > 0 && opciones.length === 0 && !modoSumaDirecta && (
        <div className="card no-print">
          <div className="helper-text">Todavía no creaste ninguna Opción. Agregá al menos una para ver resultados.</div>
        </div>
      )}

      {familiasRegistradas.length === 0 ? (
        <div className="resultados-grid" style={{ display: "grid", gridTemplateColumns: resultados.length > 1 ? `repeat(${Math.min(resultados.length, 3)}, 1fr)` : "1fr", gap: 16 }}>
          {resultados.map((r) => (
            <div className="card result-card" key={r.id} style={{ marginBottom: 0 }}>
              <div className="section-title" style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 6 }}>
                <span style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  <span>{r.nombre || "Resultado"}</span>
                  {destinos.length > 0 && opciones.length > 0 && (() => {
                    const opcion = opciones.find((o) => o.id === r.id);
                    if (!opcion) return null;
                    const partes = destinos
                      .map((d) => {
                        const itemId = opcion.selecciones[d];
                        const it = items.find((x) => x.id === itemId);
                        return it ? shortLabel(it) : null;
                      })
                      .filter(Boolean);
                    if (!partes.length) return null;
                    return <span style={{ fontSize: 11, fontWeight: 400, color: "var(--text-soft)", textTransform: "none", letterSpacing: 0 }}>{partes.join(" + ")}</span>;
                  })()}
                </span>
                <span style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  {r.incompleta && <span className="badge-warn">Falta elegir un destino</span>}
                  {minTotal !== null && r.totales.totalFinal === minTotal && <span className="badge-best">Más económica</span>}
                  {opcionConfirmada === r.id
                    ? <span style={{ display: "flex", gap: 6, alignItems: "center" }}>
                        <span className="badge-confirmada">✓ Confirmada</span>
                        <button className="btn-secondary" style={{ fontSize: 11, padding: "3px 9px", color: "var(--text-soft)" }} onClick={() => setOpcionConfirmada(null)}>Quitar confirmación</button>
                      </span>
                    : <button className="btn-confirmar" onClick={() => setOpcionConfirmada(r.id)}>Confirmar esta opción</button>
                  }
                  {opcionConfirmada && opcionConfirmada !== r.id && <span style={{ fontSize: 11, color: "var(--text-soft)" }}>No elegida</span>}
                </span>
              </div>
              <div style={{ opacity: opcionConfirmada && opcionConfirmada !== r.id ? 0.4 : 1, transition: "opacity 0.2s" }}>
              <div className="result-row muted"><span>Total bruto</span><span>{fmtMoneda(r.totales.totalBruto, moneda)}</span></div>
              <div className="result-row muted"><span>+ Fee Pristine</span><span>{fmtMoneda(r.totales.fee, moneda)}</span></div>
              <div className="result-row muted"><span>Comisión + fee (comisionable)</span><span>{fmtMoneda(r.totales.gananciaComisionable, moneda)}</span></div>
              <div className="result-row"><span>+ Gastos Pristine (42% = 21+6+15)</span><span>{fmtMoneda(r.totales.gastosPristine, moneda)}</span></div>
              <div className="result-row"><span>+ Gastos operador (%)</span><span>{fmtMoneda(r.totales.totalGastoOperadorPct, moneda)}</span></div>
              <div className="result-row"><span>+ Gastos de reserva</span><span>{fmtMoneda(r.totales.totalGastoReserva, moneda)}</span></div>
              <div className="result-row"><span>+ Fee de emisión</span><span>{fmtMoneda(r.totales.totalFeeEmision, moneda)}</span></div>
              <div className="result-row muted"><span>Subtotal</span><span>{fmtMoneda(r.totales.subtotal, moneda)}</span></div>
              <div className="result-row"><span>+ Gastos bancarios (1,2%)</span><span>{fmtMoneda(r.totales.gastosBancarios, moneda)}</span></div>
              <div className="result-row final"><span>Total a pagar</span><span>{fmtMoneda(r.totales.totalFinal, moneda)}</span></div>
              <div style={{ marginTop: 14, textAlign: "right" }}>
                <div className="field-label" style={{ textAlign: "right" }}>Por pasajero ({paxCount || 1} pax)</div>
                <div className="result-total">{fmtMoneda(r.totales.totalPorPasajero, moneda)}</div>
              </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        resultados.map((r) => (
          <div className="card" key={r.id} style={{ marginBottom: 16 }}>
            <div className="section-title" style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 6 }}>
              <span style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <span>{r.nombre || "Resultado"}</span>
                {destinos.length > 0 && opciones.length > 0 && (() => {
                  const opcion = opciones.find((o) => o.id === r.id);
                  if (!opcion) return null;
                  const partes = destinos
                    .map((d) => {
                      const itemId = opcion.selecciones[d];
                      const it = items.find((x) => x.id === itemId);
                      return it ? shortLabel(it) : null;
                    })
                    .filter(Boolean);
                  if (!partes.length) return null;
                  return <span style={{ fontSize: 11, fontWeight: 400, color: "var(--text-soft)", textTransform: "none", letterSpacing: 0 }}>{partes.join(" + ")}</span>;
                })()}
              </span>
              {r.incompleta && <span className="badge-warn">Falta elegir un destino</span>}
            </div>
            <div className="resultados-grid" style={{ display: "grid", gridTemplateColumns: r.familiaResultados.length > 1 ? `repeat(${Math.min(r.familiaResultados.length, 3)}, 1fr)` : "1fr", gap: 16 }}>
              {r.familiaResultados.map((fr) => {
                let subtituloFamilia = "";
                if (destinos.length > 0 && opciones.length > 0) {
                  const opcion = opciones.find((o) => o.id === r.id);
                  if (opcion) {
                    const partes = destinos
                      .map((d) => {
                        const sel = opcion.selecciones[d];
                        const itemId = sel && typeof sel === "object" ? sel[fr.familiaId] : sel;
                        const it = items.find((x) => x.id === itemId);
                        return it ? shortLabel(it) : null;
                      })
                      .filter(Boolean);
                    subtituloFamilia = partes.join(" + ");
                  }
                }
                const estaConfirmadaPorEstaFamilia = opcionesConfirmadasPorFamilia[fr.familiaId] === r.id;
                const otraOpcionConfirmadaPorEstaFamilia = opcionesConfirmadasPorFamilia[fr.familiaId] && opcionesConfirmadasPorFamilia[fr.familiaId] !== r.id;
                return (
                  <div className="card result-card" key={fr.familiaNombre} style={{ marginBottom: 0, background: estaConfirmadaPorEstaFamilia ? "#F0FBF4" : "#FAFAFD", border: estaConfirmadaPorEstaFamilia ? "2px solid var(--green)" : undefined, opacity: otraOpcionConfirmadaPorEstaFamilia ? 0.45 : 1, transition: "opacity 0.2s, border 0.2s, background 0.2s" }}>
                    <div className="section-title" style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 6 }}>
                      <span style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                        <span>{fr.familiaNombre} ({fr.paxFamilia} pax)</span>
                        {subtituloFamilia && <span style={{ fontSize: 11, fontWeight: 400, color: "var(--text-soft)", textTransform: "none", letterSpacing: 0 }}>{subtituloFamilia}</span>}
                      </span>
                      {minTotalPorFamilia[fr.familiaId] !== undefined && fr.totalFinal === minTotalPorFamilia[fr.familiaId] && <span className="badge-best">Más económica</span>}
                    </div>
                    <div style={{ marginBottom: 10 }}>
                      {estaConfirmadaPorEstaFamilia
                        ? <span style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                            <span className="badge-confirmada">✓ Confirmada por {fr.familiaNombre}</span>
                            <button className="btn-secondary" style={{ fontSize: 10.5, padding: "2px 8px", color: "var(--text-soft)" }} onClick={() => setOpcionesConfirmadasPorFamilia((prev) => { const n = { ...prev }; delete n[fr.familiaId]; return n; })}>Quitar</button>
                          </span>
                        : <button className="btn-confirmar" style={{ fontSize: 11 }} onClick={() => setOpcionesConfirmadasPorFamilia((prev) => ({ ...prev, [fr.familiaId]: r.id }))}>Confirmar para {fr.familiaNombre}</button>
                      }
                      {otraOpcionConfirmadaPorEstaFamilia && <div style={{ fontSize: 10.5, color: "var(--text-soft)", marginTop: 3 }}>Esta familia ya confirmó otra opción</div>}
                    </div>
                    <div className="result-row muted"><span>Total bruto</span><span>{fmtMoneda(fr.totalBruto, moneda)}</span></div>
                    <div className="result-row muted"><span>+ Fee Pristine</span><span>{fmtMoneda(fr.fee, moneda)}</span></div>
                    <div className="result-row muted"><span>Comisión + fee (comisionable)</span><span>{fmtMoneda(fr.gananciaComisionable, moneda)}</span></div>
                    <div className="result-row"><span>+ Gastos Pristine (42% = 21+6+15)</span><span>{fmtMoneda(fr.gastosPristine, moneda)}</span></div>
                    <div className="result-row"><span>+ Gastos operador (%)</span><span>{fmtMoneda(fr.totalGastoOperadorPct, moneda)}</span></div>
                    <div className="result-row"><span>+ Gastos de reserva (prorrateado)</span><span>{fmtMoneda(fr.totalGastoReserva, moneda)}</span></div>
                    <div className="result-row"><span>+ Fee de emisión</span><span>{fmtMoneda(fr.totalFeeEmision, moneda)}</span></div>
                    <div className="result-row muted"><span>Subtotal</span><span>{fmtMoneda(fr.subtotal, moneda)}</span></div>
                    <div className="result-row"><span>+ Gastos bancarios (1,2%)</span><span>{fmtMoneda(fr.gastosBancarios, moneda)}</span></div>
                    <div className="result-row final"><span>Total a pagar</span><span>{fmtMoneda(fr.totalFinal, moneda)}</span></div>
                    <div style={{ marginTop: 14, textAlign: "right" }}>
                      <div className="field-label" style={{ textAlign: "right" }}>Por pasajero ({fr.paxFamilia} pax)</div>
                      <div className="result-total">{fmtMoneda(fr.totalPorPasajero, moneda)}</div>
                    </div>
                    {estaConfirmadaPorEstaFamilia && (
                      <div className="helper-text" style={{ marginTop: 8, color: "var(--amber)" }}>
                        Nota: el número exacto que cobrarle a esta familia (con el gasto de reserva prorrateado correctamente entre todas las familias confirmadas que comparten operador) se calcula en el módulo de Cobros a clientes, más abajo. Este total es una referencia comparativa.
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))
      )}

      {/* MÓDULO: PAGOS A OPERADORES */}
      {(() => {
        const todosLosOperadoresUsados = [...new Set(items.filter((it) => it.operadorId).map((it) => it.operadorId))];
        if (!todosLosOperadoresUsados.length) return null;
        const hayAlgunaConfirmacion = familiasRegistradas.length > 0
          ? familiasRegistradas.some((f) => opcionesConfirmadasPorFamilia[f.id])
          : !!opcionConfirmada;
        if (!hayAlgunaConfirmacion) {
          return (
            <div className="card no-print">
              <div className="section-title">Pagos a operadores</div>
              <div className="helper-text">{familiasRegistradas.length > 0 ? "Confirmá la opción elegida por cada familia para calcular cuánto le corresponde pagar a cada operador." : "Confirmá una opción en los resultados para calcular cuánto le corresponde pagar a cada operador."} Hasta entonces no se muestran montos, para evitar sumar alternativas que no se van a contratar.</div>
            </div>
          );
        }
        const itemsEfectivos = familiasRegistradas.length > 0
          ? familiasRegistradas.flatMap((f) => itemsEfectivosDeFamilia(f.id))
          : itemsEfectivosConfirmados();
        const opUsados = [...new Set(itemsEfectivos.filter((it) => it.operadorId).map((it) => it.operadorId))];
        if (!opUsados.length) return null;
        const mFmt = MONEDAS[moneda] || MONEDAS.USD;
        const totalDeuda = opUsados.reduce((s, id) => s + montoEfectivoOperador(id), 0);
        const totalPagado = opUsados.reduce((s, id) => s + totalPagadoOperador(id), 0);
        const totalSaldo = totalDeuda - totalPagado;
        return (
          <div className="card no-print">
            <div className="section-title">Pagos a operadores</div>
            {opUsados.map((opId) => {
              const op = operadores.find((o) => o.id === opId);
              if (!op) return null;
              const calculado = montoCalculadoOperador(opId);
              const efectivo = montoEfectivoOperador(opId);
              const pagado = totalPagadoOperador(opId);
              const saldo = efectivo - pagado;
              const pct = efectivo > 0 ? Math.min(100, (pagado / efectivo) * 100) : 0;
              const pagosOp = pagosOperadores[opId]?.pagos || [];
              const ajustado = pagosOperadores[opId]?.montoAjustado;
              const editingMonto = editingMontoOpId === opId;
              const fmtMonto = (v) => v != null && v !== "" ? `${mFmt.prefix} ${parseFloat(String(v).replace(/\./g,"").replace(",",".")).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "";
              return (
                <div className="modulo-operador" key={opId}>
                  <div className="modulo-operador-header">
                    <span className="modulo-op-nombre">{op.nombre}</span>
                    <button
                      className="btn-small"
                      style={{ fontSize: 11, padding: "3px 10px", background: showDetalleOp[opId] ? "var(--navy)" : "var(--navy-light)", color: showDetalleOp[opId] ? "#fff" : "var(--navy)", border: "none", borderRadius: 6, cursor: "pointer" }}
                      onClick={() => setShowDetalleOp((prev) => ({ ...prev, [opId]: !prev[opId] }))}
                    >
                      {showDetalleOp[opId] ? "▲ Ocultar desglose" : "▼ Ver desglose"}
                    </button>
                  </div>
                  {showDetalleOp[opId] && (() => {
                    // Obtener ítems efectivos de este operador
                    const itemsEf = familiasRegistradas.length === 0
                      ? itemsEfectivosConfirmados().filter((it) => it.operadorId === opId)
                      : (() => {
                          const famConf = (modoSumaDirecta || opciones.length === 0)
                            ? familiasRegistradas
                            : familiasRegistradas.filter((f) => opcionesConfirmadasPorFamilia[f.id]);
                          const compartidos = items.filter((it) => !it.familiaId && it.operadorId === opId);
                          const deFamilias = [];
                          famConf.forEach((fam) => {
                            if (modoSumaDirecta || opciones.length === 0) {
                              // Sin opciones: todos los ítems de esta familia para este operador
                              items.filter((it) => it.familiaId === fam.id && it.operadorId === opId)
                                .forEach((it) => deFamilias.push({ it, fam }));
                            } else {
                              const opcionId = opcionesConfirmadasPorFamilia[fam.id];
                              const opObj = opciones.find((o) => o.id === opcionId);
                              items.filter((it) => it.familiaId === fam.id && (!it.destino || !it.destino.trim()) && it.operadorId === opId)
                                .forEach((it) => deFamilias.push({ it, fam }));
                              if (opObj && destinos.length > 0) {
                                destinos.forEach((d) => {
                                  const sel = opObj.selecciones[d];
                                  if (!sel) return;
                                  const itemId = typeof sel === "object" ? sel[fam.id] : sel;
                                  const it = items.find((x) => x.id === itemId && x.operadorId === opId);
                                  if (it) deFamilias.push({ it, fam });
                                });
                              }
                            }
                          });
                          return { compartidos, deFamilias };
                        })();

                    const paxTot = familiasRegistradas.length === 0
                      ? (paxCount || 1)
                      : (modoSumaDirecta || opciones.length === 0
                          ? familiasRegistradas
                          : familiasRegistradas.filter((f) => opcionesConfirmadasPorFamilia[f.id])
                        ).reduce((s, f) => s + (parseFloat(f.pax) || 0), 0) || (paxCount || 1);

                    const filas = [];
                    let sumNeto = 0, sumFee = 0, sumGasto = 0, sumTotal = 0;

                    const addFila = (it, paxN, etiqueta) => {
                      const c = calcItem(it, paxN);
                      const fee = it.aplicaFeeEmision ? (parseFloat(it.feeEmision) || 0) * cantidadBoletosItem(it, paxN) : 0;
                      const base = c.neto + fee;
                      const gasto = (base * (parseFloat(it.pctGastoOperador) || 0)) / 100;
                      const total = base + gasto;
                      sumNeto += c.neto; sumFee += fee; sumGasto += gasto; sumTotal += total;
                      filas.push({ label: (it.descripcion || "ítem") + (etiqueta ? ` (${etiqueta})` : ""), neto: c.neto, fee, gasto, total });
                    };

                    if (Array.isArray(itemsEf)) {
                      itemsEf.forEach((it) => addFila(it, paxTot, null));
                    } else {
                      itemsEf.compartidos.forEach((it) => addFila(it, paxTot, "compartido"));
                      itemsEf.deFamilias.forEach(({ it, fam }) => addFila(it, parseFloat(fam.pax) || 0, fam.nombre));
                    }

                    const itemsReales = pagosOperadores[opId]?.itemsReales || {};
                    const gastoRes = parseFloat(op.gastoReserva) || 0;
                    const gastoResReal = itemsReales["gastoRes"] !== undefined && itemsReales["gastoRes"] !== ""
                      ? parseFloat(String(itemsReales["gastoRes"]).replace(/\./g,"").replace(",",".")) || 0
                      : gastoRes;
                    const fmt2 = (n) => `${mFmt.prefix} ${n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                    let sumRealItems = 0;
                    filas.forEach((f, i) => {
                      const rv = itemsReales[i];
                      sumRealItems += rv !== undefined && rv !== "" ? parseFloat(String(rv).replace(/\./g,"").replace(",",".")) || 0 : f.total;
                    });
                    const sumRealTotal = sumRealItems + gastoResReal;
                    const showReal = showDetalleReal?.[opId] || false;

                    return (
                      <>
                        {/* Tabla cotizada — limpia */}
                        <div style={{ overflowX: "auto", marginBottom: 12 }}>
                          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                            <thead>
                              <tr style={{ background: "var(--navy)", color: "#fff" }}>
                                <th style={{ padding: "6px 8px", textAlign: "left" }}>Ítem</th>
                                <th style={{ padding: "6px 8px", textAlign: "right" }}>Neto</th>
                                <th style={{ padding: "6px 8px", textAlign: "right" }}>Fee emis.</th>
                                <th style={{ padding: "6px 8px", textAlign: "right" }}>Gastos op.</th>
                                <th style={{ padding: "6px 8px", textAlign: "right" }}>Total cotizado</th>
                              </tr>
                            </thead>
                            <tbody>
                              {filas.map((f, i) => (
                                <tr key={i} style={{ background: i % 2 === 0 ? "#fff" : "var(--bg)" }}>
                                  <td style={{ padding: "5px 8px" }}>{f.label}</td>
                                  <td style={{ padding: "5px 8px", textAlign: "right" }}>{fmt2(f.neto)}</td>
                                  <td style={{ padding: "5px 8px", textAlign: "right" }}>{fmt2(f.fee)}</td>
                                  <td style={{ padding: "5px 8px", textAlign: "right" }}>{fmt2(f.gasto)}</td>
                                  <td style={{ padding: "5px 8px", textAlign: "right", fontWeight: 600 }}>{fmt2(f.total)}</td>
                                </tr>
                              ))}
                              <tr style={{ borderTop: "2px solid var(--border)", fontWeight: 700, background: "var(--navy-light)" }}>
                                <td style={{ padding: "5px 8px" }}>Subtotal ítems</td>
                                <td style={{ padding: "5px 8px", textAlign: "right" }}>{fmt2(sumNeto)}</td>
                                <td style={{ padding: "5px 8px", textAlign: "right" }}>{fmt2(sumFee)}</td>
                                <td style={{ padding: "5px 8px", textAlign: "right" }}>{fmt2(sumGasto)}</td>
                                <td style={{ padding: "5px 8px", textAlign: "right" }}>{fmt2(sumTotal)}</td>
                              </tr>
                              {gastoRes > 0 && (
                                <tr style={{ background: "#fff" }}>
                                  <td style={{ padding: "5px 8px", fontStyle: "italic" }}>Gasto de reserva (único)</td>
                                  <td colSpan={3} />
                                  <td style={{ padding: "5px 8px", textAlign: "right", fontWeight: 600 }}>{fmt2(gastoRes)}</td>
                                </tr>
                              )}
                              <tr style={{ borderTop: "2px solid var(--navy)", fontWeight: 700, background: "var(--navy)", color: "#fff" }}>
                                <td style={{ padding: "6px 8px" }}>TOTAL COTIZADO</td>
                                <td colSpan={3} />
                                <td style={{ padding: "6px 8px", textAlign: "right" }}>{fmt2(sumTotal + gastoRes)}</td>
                              </tr>
                            </tbody>
                          </table>
                        </div>

                        {/* Sección liquidación real — colapsable */}
                        <div style={{ border: "1.5px solid var(--border)", borderRadius: 8, marginBottom: 12, overflow: "hidden" }}>
                          <button
                            onClick={() => setShowDetalleReal(prev => ({ ...prev, [opId]: !showReal }))}
                            style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", background: showReal ? "var(--navy)" : "var(--navy-light)", border: "none", cursor: "pointer", fontSize: 12, fontWeight: 700, color: showReal ? "#fff" : "var(--navy)" }}
                          >
                            <span>📋 Liquidación real del operador</span>
                            <span>{showReal ? "▲ Cerrar" : "▼ Ingresar valores reales"}</span>
                          </button>
                          {showReal && (
                            <div style={{ padding: "12px 14px", background: "#F8F9FF" }}>
                              <p style={{ fontSize: 11, color: "var(--text-soft)", marginBottom: 10 }}>
                                Ingresá los valores de la liquidación real del operador. Si dejás un campo vacío, usa el cotizado.
                              </p>
                              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                                <thead>
                                  <tr style={{ background: "var(--navy-light)" }}>
                                    <th style={{ padding: "5px 8px", textAlign: "left", fontWeight: 700 }}>Ítem</th>
                                    <th style={{ padding: "5px 8px", textAlign: "right", fontWeight: 700 }}>Cotizado</th>
                                    <th style={{ padding: "5px 8px", textAlign: "right", fontWeight: 700 }}>Real</th>
                                    <th style={{ padding: "5px 8px", textAlign: "right", fontWeight: 700 }}>Dif.</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {filas.map((f, i) => {
                                    const rv = itemsReales[i];
                                    const realN = rv !== undefined && rv !== "" ? parseFloat(String(rv).replace(/\./g,"").replace(",",".")) || 0 : f.total;
                                    const diff = realN - f.total;
                                    return (
                                      <tr key={i} style={{ background: i % 2 === 0 ? "#fff" : "var(--bg)", borderBottom: "1px solid var(--border)" }}>
                                        <td style={{ padding: "5px 8px" }}>{f.label}</td>
                                        <td style={{ padding: "5px 8px", textAlign: "right", color: "var(--text-soft)" }}>{fmt2(f.total)}</td>
                                        <td style={{ padding: "5px 8px", textAlign: "right" }}>
                                          <ImporteInput
                                            value={rv !== undefined ? rv : ""}
                                            onChange={(v) => setItemRealOp(opId, i, v)}
                                            placeholder={fmt2(f.total)}
                                            style={{ width: 120, fontSize: 12 }}
                                          />
                                        </td>
                                        <td style={{ padding: "5px 8px", textAlign: "right", color: diff > 0 ? "var(--red)" : diff < 0 ? "var(--green)" : "var(--text-soft)", fontWeight: diff !== 0 ? 700 : 400 }}>
                                          {diff !== 0 ? (diff > 0 ? "+" : "") + fmt2(diff) : "—"}
                                        </td>
                                      </tr>
                                    );
                                  })}
                                  {gastoRes > 0 && (
                                    <tr style={{ background: "#fff", borderBottom: "1px solid var(--border)" }}>
                                      <td style={{ padding: "5px 8px", fontStyle: "italic" }}>Gasto de reserva</td>
                                      <td style={{ padding: "5px 8px", textAlign: "right", color: "var(--text-soft)" }}>{fmt2(gastoRes)}</td>
                                      <td style={{ padding: "5px 8px", textAlign: "right" }}>
                                        <ImporteInput
                                          value={itemsReales["gastoRes"] !== undefined ? itemsReales["gastoRes"] : ""}
                                          onChange={(v) => setItemRealOp(opId, "gastoRes", v)}
                                          placeholder={fmt2(gastoRes)}
                                          style={{ width: 120, fontSize: 12 }}
                                        />
                                      </td>
                                      <td style={{ padding: "5px 8px", textAlign: "right", color: gastoResReal - gastoRes > 0 ? "var(--red)" : gastoResReal - gastoRes < 0 ? "var(--green)" : "var(--text-soft)" }}>
                                        {gastoResReal - gastoRes !== 0 ? (gastoResReal - gastoRes > 0 ? "+" : "") + fmt2(gastoResReal - gastoRes) : "—"}
                                      </td>
                                    </tr>
                                  )}
                                  <tr style={{ borderTop: "2px solid var(--navy)", fontWeight: 700, background: "var(--navy)", color: "#fff" }}>
                                    <td style={{ padding: "6px 8px" }}>TOTAL REAL</td>
                                    <td style={{ padding: "6px 8px", textAlign: "right", opacity: .75 }}>{fmt2(sumTotal + gastoRes)}</td>
                                    <td style={{ padding: "6px 8px", textAlign: "right" }}>{fmt2(sumRealTotal)}</td>
                                    <td style={{ padding: "6px 8px", textAlign: "right" }}>
                                      {(() => { const d = sumRealTotal - (sumTotal + gastoRes); return d !== 0 ? <span style={{ color: d > 0 ? "#FFB3B3" : "#B3FFD1" }}>{d > 0 ? "+" : ""}{fmt2(d)}</span> : "—"; })()}
                                    </td>
                                  </tr>
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      </>
                    );
                  })()}
                  <div className="modulo-montos">

                    <div className="modulo-monto-item">
                      <span className="modulo-monto-label">Monto a pagar</span>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <input
                          type="text"
                          value={editingMonto ? (ajustado != null ? ajustado : "") : (ajustado != null ? fmtMonto(ajustado) : "")}
                          placeholder={`${mFmt.prefix} ${calculado.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                          onFocus={() => setEditingMontoOpId(opId)}
                          onBlur={() => setEditingMontoOpId(null)}
                          onChange={(e) => setMontoAjustadoOp(opId, e.target.value === "" ? null : e.target.value)}
                          style={{ width: 160, fontSize: 14, fontWeight: 700 }}
                        />
                        {ajustado != null && (
                          <button
                            className="btn-icon neutral"
                            title="Volver al valor calculado"
                            onClick={() => setMontoAjustadoOp(opId, null)}
                          >
                            <RotateCcw size={14} />
                          </button>
                        )}
                        <span style={{ fontSize: 11, color: "var(--text-soft)" }}>
                          {ajustado != null
                            ? `calc: ${mFmt.prefix} ${calculado.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                            : "(calculado automático)"}
                        </span>
                      </div>
                    </div>
                    <div className="modulo-monto-item">
                      <span className="modulo-monto-label">Pagado</span>
                      <span className={`modulo-monto-val pagado`}>{mFmt.prefix} {pagado.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                    <div className="modulo-monto-item">
                      <span className="modulo-monto-label">Saldo pendiente</span>
                      <span className={`modulo-monto-val ${saldo <= 0 ? "saldo-ok" : "saldo-pend"}`}>{mFmt.prefix} {Math.max(0, saldo).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                  </div>
                  <div className="barra-prog-wrap"><div className="barra-prog" style={{ width: `${pct}%` }} /></div>
                  {pagosOp.length > 0 && (
                    <table className="tabla-pagos" style={{ marginBottom: 10 }}>
                      <thead><tr>
                        <th>Fecha</th><th>Moneda</th>
                        <th style={{ textAlign: "right" }}>{moneda === "ARS" ? "ARS" : "USD"}</th>
                        {moneda !== "ARS" && <th style={{ textAlign: "right" }}>ARS</th>}
                        <th style={{ textAlign: "right" }}>EUR</th>
                        <th>Tipo de cambio</th><th />
                      </tr></thead>
                      <tbody>
                        {pagosOp.map((p) => (
                          <FilaPago key={p.id} pago={p} monedaCot={moneda}
                            onUpdate={(campo, val) => updatePagoOperador(opId, p.id, campo, val)}
                            onRemove={() => removePagoOperador(opId, p.id)}
                          />
                        ))}
                      </tbody>
                    </table>
                  )}
                  <button className="btn-secondary" style={{ fontSize: 12 }} onClick={() => addPagoOperador(opId)}>
                    <Plus size={13} /> Registrar pago
                  </button>
                </div>
              );
            })}
            <div className="consolidado-modulo">
              <div className="consolidado-item"><span className="consolidado-label">Total a pagar</span><span className="consolidado-val" style={{ color: "var(--navy)" }}>{mFmt.prefix} {totalDeuda.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>
              <div className="consolidado-item"><span className="consolidado-label">Total pagado</span><span className="consolidado-val" style={{ color: "var(--green)" }}>{mFmt.prefix} {totalPagado.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>
              <div className="consolidado-item"><span className="consolidado-label">Saldo pendiente</span><span className="consolidado-val" style={{ color: totalSaldo <= 0 ? "var(--green)" : "var(--amber)" }}>{mFmt.prefix} {Math.max(0, totalSaldo).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>
            </div>
          </div>
        );
      })()}

      {/* MÓDULO: COBROS A CLIENTES */}
      {(() => {
        const mFmt = MONEDAS[moneda] || MONEDAS.USD;
        const pagadores = familiasRegistradas.length > 0
          ? familiasRegistradas.map((f) => ({ id: f.id, nombre: f.nombre || "(sin nombre)", titular: f.titular || "", tel: f.tel || "" }))
          : [{ id: "titular", nombre: titularGeneral.nombre || cliente || "Cliente", titular: titularGeneral.nombre || "", tel: titularGeneral.tel || "" }];

        const hayAlgunaConfirmacion = familiasRegistradas.length > 0
          ? familiasRegistradas.some((f) => opcionesConfirmadasPorFamilia[f.id])
          : !!opcionConfirmada;

        if (!hayAlgunaConfirmacion) {
          return (
            <div className="card no-print">
              <div className="section-title">Cobros a clientes</div>
              <div className="helper-text">{familiasRegistradas.length > 0 ? "Confirmá la opción elegida por cada familia para que el sistema calcule el monto a cobrarle." : "Confirmá una opción en los resultados para que el sistema calcule el monto a cobrar a cada pagador."} Hasta entonces no se muestran montos, para evitar sumar alternativas que no se van a contratar.</div>
            </div>
          );
        }

        const totalDeuda = pagadores.reduce((s, p) => {
          const m = montoCobrarPagador(p.id);
          return s + (m != null ? m : 0);
        }, 0);
        const totalCobrado = pagadores.reduce((s, p) => s + totalCobradoPagador(p.id), 0);
        const totalSaldo = totalDeuda - totalCobrado;

        return (
          <div className="card no-print">
            <div className="section-title">Cobros a clientes</div>
            {familiasRegistradas.length > 0 && pagadores.some((p) => !opcionesConfirmadasPorFamilia[p.id]) && (
              <div className="helper-text" style={{ marginBottom: 10 }}>Las familias sin opción confirmada todavía no muestran monto.</div>
            )}
            {pagadores.map((pag) => {
              const monto = montoCobrarPagador(pag.id);
              const cobrado = totalCobradoPagador(pag.id);
              const saldo = monto != null ? monto - cobrado : null;
              const pct = monto != null && monto > 0 ? Math.min(100, (cobrado / monto) * 100) : 0;
              const pagosCliente = cobrosClientes[pag.id]?.pagos || [];
              return (
                <div className="modulo-operador" key={pag.id}>
                  <div className="modulo-operador-header">
                    <span className="modulo-op-nombre">{pag.nombre}</span>
                    {pag.titular && <span style={{ fontSize: 12, color: "var(--text-soft)" }}>Titular: {pag.titular}</span>}
                  </div>
                  <div className="modulo-montos">
                    <div className="modulo-monto-item">
                      <span className="modulo-monto-label">Monto a cobrar</span>
                      <span className="modulo-monto-val deuda">
                        {monto != null ? `${mFmt.prefix} ${monto.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—"}
                      </span>
                    </div>
                    <div className="modulo-monto-item">
                      <span className="modulo-monto-label">Cobrado</span>
                      <span className="modulo-monto-val pagado">{mFmt.prefix} {cobrado.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                    <div className="modulo-monto-item">
                      <span className="modulo-monto-label">Saldo pendiente</span>
                      <span className={`modulo-monto-val ${saldo != null && saldo <= 0 ? "saldo-ok" : "saldo-pend"}`}>
                        {saldo != null ? `${mFmt.prefix} ${Math.max(0, saldo).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—"}
                      </span>
                    </div>
                  </div>
                  {monto != null && <div className="barra-prog-wrap"><div className="barra-prog" style={{ width: `${pct}%` }} /></div>}
                  {pagosCliente.length > 0 && (
                    <table className="tabla-pagos" style={{ marginBottom: 10 }}>
                      <thead><tr>
                        <th>Fecha</th><th>Moneda</th>
                        <th style={{ textAlign: "right" }}>{moneda === "ARS" ? "ARS" : "USD"}</th>
                        {moneda !== "ARS" && <th style={{ textAlign: "right" }}>ARS</th>}
                        <th style={{ textAlign: "right" }}>EUR</th>
                        <th>Tipo de cambio</th><th />
                      </tr></thead>
                      <tbody>
                        {pagosCliente.map((p) => (
                          <FilaPago key={p.id} pago={p} monedaCot={moneda}
                            onUpdate={(campo, val) => updateCobroPagador(pag.id, p.id, campo, val)}
                            onRemove={() => removeCobroPagador(pag.id, p.id)}
                          />
                        ))}
                      </tbody>
                    </table>
                  )}
                  <button className="btn-secondary" style={{ fontSize: 12 }} onClick={() => addCobroPagador(pag.id)}>
                    <Plus size={13} /> Registrar cobro
                  </button>
                </div>
              );
            })}
            <div className="consolidado-modulo">
              <div className="consolidado-item"><span className="consolidado-label">Total a cobrar</span><span className="consolidado-val" style={{ color: "var(--navy)" }}>{mFmt.prefix} {totalDeuda.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>
              <div className="consolidado-item"><span className="consolidado-label">Total cobrado</span><span className="consolidado-val" style={{ color: "var(--green)" }}>{mFmt.prefix} {totalCobrado.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>
              <div className="consolidado-item"><span className="consolidado-label">Saldo pendiente</span><span className="consolidado-val" style={{ color: totalSaldo <= 0 ? "var(--green)" : "var(--amber)" }}>{mFmt.prefix} {Math.max(0, totalSaldo).toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>
            </div>
          </div>
        );
      })()}

      <div className="no-print" style={{ display: "flex", justifyContent: "center", gap: 12, marginTop: 8, marginBottom: 24, flexWrap: "wrap", alignItems: "center" }}>
        <button className="btn-primary" onClick={() => descargarVistaImpresion("interno")}>
          Imprimir / PDF interno
        </button>
        <button className="btn-primary" style={{ background: "var(--amber)" }} onClick={() => descargarVistaImpresion("pasajero")}>
          Enviar al pasajero
        </button>
        {(() => {
          const hayConFamilias = familiasRegistradas.length > 0;
          const sinOpciones = modoSumaDirecta || opciones.length === 0;
          const algunaConfirmada = hayConFamilias
            ? (sinOpciones ? familiasRegistradas.some(f => opcionesConfirmadasPorFamilia[f.id]) || true : familiasRegistradas.some(f => opcionesConfirmadasPorFamilia[f.id]))
            : (sinOpciones ? resultados.length > 0 && items.length > 0 : !!opcionConfirmada);
          const todasConfirmadas = hayConFamilias
            ? familiasRegistradas.every(f => opcionesConfirmadasPorFamilia[f.id])
            : !!opcionConfirmada;
          if (!algunaConfirmada) {
            return (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                <button className="btn-primary" style={{ background: "var(--navy-mid)", cursor: "default" }} disabled>
                  Liquidar
                </button>
                <span style={{ fontSize: 11, color: "var(--text-soft)", textAlign: "center" }}>
                  {hayConFamilias ? "Confirmá la opción de cada familia primero" : "Confirmá una opción en los resultados primero"}
                </span>
              </div>
            );
          }
          return (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
              <button className="btn-primary" style={{ background: "var(--green)" }} onClick={() => mostrarLiquidacion()}>
                Liquidar
              </button>
              {hayConFamilias && !todasConfirmadas && !sinOpciones && (
                <span style={{ fontSize: 11, color: "var(--text-soft)", textAlign: "center", width: "100%" }}>Solo se genera para las familias que ya confirmaron</span>
              )}
            </div>
          );
        })()}
      </div>
    </div>
  );
}

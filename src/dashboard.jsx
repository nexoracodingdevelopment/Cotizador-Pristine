import { FilePlus, History, User, LogOut, Contact, UserCheck } from "lucide-react";
import "./styles.css";

export default function Dashboard({ usuario, nuevaCotizacion, cerrarSesion, miCuenta, historial, clientes, pasajeros }) {
  return (
    <div style={{ minHeight: "100vh" }}>
      <header className="topbar">
        <div className="topbar-brand">
          PRISTINE
          <span>Portal de clientes</span>
        </div>
        <div className="topbar-right">
          <div className="topbar-user">
            <span>Bienvenido</span>
            <strong>{usuario?.contacto || usuario?.empresa || "Cliente"}</strong>
          </div>
        </div>
      </header>

      <div style={{ maxWidth: 860, margin: "0 auto", padding: "52px 24px" }}>
        <div className="page-header">
          <div className="page-eyebrow">Portal de clientes</div>
          <h1 className="page-title">Bienvenido de nuevo</h1>
          <p className="page-sub">Seleccioná una opción para continuar.</p>
        </div>

        {/*
          5 tiles: fila 1 → 3 columnas, fila 2 → 2 columnas centradas.
          Se logra con CSS grid + span en los últimos dos tiles.
        */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(6, 1fr)",
          gap: "1px",
          background: "var(--border)",
          border: "1px solid var(--border)",
          marginBottom: 1,
        }}>
          {/* fila 1: 3 tiles, cada uno ocupa 2 de 6 columnas */}
          <TileWrap span={2}><ActionTile icon={<FilePlus size={26} />} titulo="Nueva cotización" desc="Iniciá una consulta de viaje." onClick={nuevaCotizacion} /></TileWrap>
          <TileWrap span={2}><ActionTile icon={<History size={26} />} titulo="Mis cotizaciones" desc="Revisá tus propuestas anteriores." onClick={historial} /></TileWrap>
          <TileWrap span={2}><ActionTile icon={<Contact size={26} />} titulo="Clientes" desc="Cartera de clientes." onClick={clientes} /></TileWrap>

          {/* fila 2: 2 tiles centrados, cada uno ocupa 3 de 6 columnas */}
          <TileWrap span={3}><ActionTile icon={<UserCheck size={26} />} titulo="Pasajeros" desc="Fichas y documentos de pasajeros." onClick={pasajeros} /></TileWrap>
          <TileWrap span={3}><ActionTile icon={<User size={26} />} titulo="Mi cuenta" desc="Datos personales y contraseña." onClick={miCuenta} /></TileWrap>
        </div>

        <div style={{ borderLeft: "1px solid var(--border)", borderRight: "1px solid var(--border)", borderBottom: "1px solid var(--border)" }}>
          <button
            className="action-tile"
            onClick={cerrarSesion}
            style={{ width: "100%", borderTop: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 14, padding: "18px 28px" }}
          >
            <div className="action-tile-icon" style={{ marginBottom: 0 }}><LogOut size={18} /></div>
            <span style={{ fontSize: ".85rem", color: "var(--text-soft)", fontFamily: "Inter, sans-serif" }}>Cerrar sesión</span>
          </button>
        </div>
      </div>
    </div>
  );
}

function TileWrap({ span, children }) {
  return (
    <div style={{ gridColumn: `span ${span}`, background: "var(--bg, #fff)" }}>
      {children}
    </div>
  );
}

function ActionTile({ icon, titulo, desc, onClick }) {
  return (
    <button className="action-tile" onClick={onClick} style={{ width: "100%" }}>
      <div className="action-tile-icon">{icon}</div>
      <div className="action-tile-title">{titulo}</div>
      <div className="action-tile-desc">{desc}</div>
    </button>
  );
}

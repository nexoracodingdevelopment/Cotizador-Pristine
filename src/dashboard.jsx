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

        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: "1px",
          background: "var(--border)",
          border: "1px solid var(--border)",
          marginBottom: 1,
        }}>
          <ActionTile icon={<FilePlus size={26} />} titulo="Nueva cotización" desc="Iniciá una consulta de viaje." onClick={nuevaCotizacion} />
          <ActionTile icon={<History size={26} />} titulo="Mis cotizaciones" desc="Revisá tus propuestas anteriores." onClick={historial} />
          <ActionTile icon={<Contact size={26} />} titulo="Clientes" desc="Cartera de clientes." onClick={clientes} />
          <ActionTile icon={<UserCheck size={26} />} titulo="Pasajeros" desc="Fichas y documentos de pasajeros." onClick={pasajeros} />
          <ActionTile icon={<User size={26} />} titulo="Mi cuenta" desc="Datos personales y contraseña." onClick={miCuenta} />
          <ActionTile icon={<LogOut size={26} />} titulo="Cerrar sesión" desc="" onClick={cerrarSesion} />
        </div>
      </div>
    </div>
  );
}

function ActionTile({ icon, titulo, desc, onClick }) {
  return (
    <button className="action-tile" onClick={onClick} style={{ width: "100%", background: "var(--bg, #fff)" }}>
      <div className="action-tile-icon">{icon}</div>
      <div className="action-tile-title">{titulo}</div>
      {desc && <div className="action-tile-desc">{desc}</div>}
    </button>
  );
}

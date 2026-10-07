import { UserPlus, Users, FileText, LogOut, Contact, UserCheck } from "lucide-react";
import "./styles.css";

export default function AdminDashboard({ usuario, nuevoUsuario, nuevaCotizacion, cerrarSesion, gestionarUsuarios, historial, clientes, pasajeros }) {
  return (
    <div className="layout">

      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="sidebar-brand-name">PRISTINE</div>
          <div className="sidebar-brand-sub">Administración</div>
        </div>
        <nav className="sidebar-nav">
          <button className="nav-item active" onClick={nuevaCotizacion}>
            <FileText size={15} /> Nueva cotización
          </button>
          <button className="nav-item" onClick={historial}>
            <FileText size={15} /> Cotizaciones
          </button>
          <button className="nav-item" onClick={clientes}>
            <Contact size={15} /> Clientes
          </button>
          <button className="nav-item" onClick={pasajeros}>
            <UserCheck size={15} /> Pasajeros
          </button>
          <button className="nav-item" onClick={nuevoUsuario}>
            <UserPlus size={15} /> Nuevo usuario
          </button>
          <button className="nav-item" onClick={gestionarUsuarios}>
            <Users size={15} /> Gestionar usuarios
          </button>
        </nav>
        <div className="sidebar-footer">
          <div className="sidebar-footer-name">{usuario?.contacto || "Administrador"}</div>
          <button className="sidebar-logout" onClick={cerrarSesion}>
            <LogOut size={13} /> Cerrar sesión
          </button>
        </div>
      </aside>

      <main className="main-content">
        <div className="page-header">
          <div className="page-eyebrow">Panel de administración</div>
          <h1 className="page-title">Bienvenido, {usuario?.contacto || "Administrador"}</h1>
          <p className="page-sub">Seleccioná una acción para continuar.</p>
        </div>

        {/* 6 tiles → 3 columnas × 2 filas, sin huecos */}
        <div className="action-grid" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
          <ActionTile icon={<FileText size={26} />} titulo="Nueva cotización" desc="Crear una cotización." onClick={nuevaCotizacion} />
          <ActionTile icon={<FileText size={26} />} titulo="Cotizaciones" desc="Ver el historial completo." onClick={historial} />
          <ActionTile icon={<Contact size={26} />} titulo="Clientes" desc="Gestionar la cartera de clientes." onClick={clientes} />
          <ActionTile icon={<UserCheck size={26} />} titulo="Pasajeros" desc="Fichas de pasajeros y documentos." onClick={pasajeros} />
          <ActionTile icon={<UserPlus size={26} />} titulo="Nuevo usuario" desc="Crear un acceso para un agente." onClick={nuevoUsuario} />
          <ActionTile icon={<Users size={26} />} titulo="Gestionar usuarios" desc="Suspender, activar o eliminar cuentas." onClick={gestionarUsuarios} />
        </div>
      </main>

    </div>
  );
}

function ActionTile({ icon, titulo, desc, onClick }) {
  return (
    <button className="action-tile" onClick={onClick}>
      <div className="action-tile-icon">{icon}</div>
      <div className="action-tile-title">{titulo}</div>
      <div className="action-tile-desc">{desc}</div>
    </button>
  );
}

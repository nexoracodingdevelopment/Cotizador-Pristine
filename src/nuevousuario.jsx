import { ArrowLeft, Copy } from "lucide-react";
import { useState } from "react";
import { supabase } from "./supabase";
import { supabaseAdmin } from "./supabaseAdmin";
import "./styles.css";


function generarPassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%";
  let pwd = "";
  for (let i = 0; i < 12; i++) pwd += chars[Math.floor(Math.random() * chars.length)];
  return pwd;
}

export default function NuevoUsuario({ volver, usuario: usuarioActual }) {
  const [empresa, setEmpresa] = useState("");
  const [contacto, setContacto] = useState("");
  const [usuario, setUsuario] = useState("");
  const [email, setEmail] = useState("");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");
  const [resultado, setResultado] = useState(null);
  const [copiado, setCopiado] = useState(false);

  async function crearUsuario() {
    if (!empresa.trim() || !contacto.trim() || !usuario.trim() || !email.trim()) {
      setError("Completá todos los campos.");
      return;
    }
    setError("");
    setCargando(true);

    try {
      const pass = generarPassword();

      // 1. Crear agencia nueva
      const { data: agenciaData, error: agenciaError } = await supabase
        .from("agencias")
        .insert([{ nombre: empresa.trim(), activo: true }])
        .select("id")
        .single();

      if (agenciaError) throw new Error("Error al crear agencia: " + agenciaError.message);
      const nuevaAgenciaId = agenciaData.id;

      // 2. Crear usuario en Supabase Auth
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: email.trim().toLowerCase(),
        password: pass,
        email_confirm: true,
      });

      if (authError) {
        // Revertir agencia creada
        await supabase.from("agencias").delete().eq("id", nuevaAgenciaId);
        throw new Error("Error al crear usuario en Auth: " + authError.message);
      }
      const nuevoUserId = authData.user.id;

      // 3. Insertar perfil en public.usuarios
      const { error: perfilError } = await supabaseAdmin
        .from("usuarios")
        .insert([{
          id: nuevoUserId,
          empresa: empresa.trim(),
          contacto: contacto.trim(),
          usuario: usuario.trim().toLowerCase(),
          email: email.trim().toLowerCase(),
          rol: "cliente",
          activo: true,
          agencia_id: nuevaAgenciaId,
        }]);

      if (perfilError) {
        // Revertir
        await supabaseAdmin.auth.admin.deleteUser(nuevoUserId);
        await supabase.from("agencias").delete().eq("id", nuevaAgenciaId);
        throw new Error("Error al crear perfil: " + perfilError.message);
      }

      // 4. Insertar configuracion base para la agencia nueva
      const { error: configError } = await supabaseAdmin
        .from("configuracion")
        .insert([
          { clave: "logo_agencia", valor: '""', agencia_id: nuevaAgenciaId },
          { clave: "datos_agencia", valor: JSON.stringify({ nombre: empresa.trim(), email: "", telefono: "", direccion: "", web: "" }), agencia_id: nuevaAgenciaId },
          { clave: "operadores", valor: JSON.stringify([{ id: "op_generico", nombre: "Operador genérico", feeEmision: 0, pctComision: 0, gastoReserva: 0, gastoOperador: 0 }]), agencia_id: nuevaAgenciaId },
          { clave: "vendedores", valor: JSON.stringify([]), agencia_id: nuevaAgenciaId },
        ]);

      if (configError) {
        // Revertir
        await supabaseAdmin.auth.admin.deleteUser(nuevoUserId);
        await supabaseAdmin.from("usuarios").delete().eq("id", nuevoUserId);
        await supabase.from("agencias").delete().eq("id", nuevaAgenciaId);
        throw new Error("Error al crear configuración: " + configError.message);
      }

      setResultado({ empresa: empresa.trim(), usuario: usuario.trim().toLowerCase(), password: pass });

    } catch (e) {
      setError(e.message);
    } finally {
      setCargando(false);
    }
  }

  function copiar() {
    navigator.clipboard.writeText(resultado.password);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 1800);
  }

  function cerrar() {
    setResultado(null);
    setEmpresa(""); setContacto(""); setUsuario(""); setEmail("");
  }

  return (
    <div style={{ minHeight: "100vh" }}>
      <header className="topbar">
        <div className="topbar-brand">PRISTINE<span>Nuevo usuario</span></div>
        <button className="btn-back" onClick={volver}><ArrowLeft size={14} /> Volver</button>
      </header>

      <div style={{ maxWidth: 560, margin: "52px auto", padding: "0 24px" }}>
        <div className="page-header">
          <div className="page-eyebrow">Administración</div>
          <h1 className="page-title">Crear usuario</h1>
          <p className="page-sub">La contraseña se genera automáticamente.</p>
        </div>

        <div className="card">
          <div className="field">
            <label className="field-label">Empresa</label>
            <input className="field-input" value={empresa} onChange={e => setEmpresa(e.target.value)} placeholder="Nombre de la empresa" />
          </div>
          <div className="field">
            <label className="field-label">Persona de contacto</label>
            <input className="field-input" value={contacto} onChange={e => setContacto(e.target.value)} placeholder="Nombre y apellido" />
          </div>
          <div className="field">
            <label className="field-label">Nombre de usuario</label>
            <input className="field-input" value={usuario} onChange={e => setUsuario(e.target.value)} placeholder="usuario123" />
          </div>
          <div className="field">
            <label className="field-label">Email</label>
            <input className="field-input" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="correo@empresa.com" />
          </div>
          {error && <p className="error-text">{error}</p>}
          <button className="btn btn-gold btn-full" onClick={crearUsuario} disabled={cargando}>
            {cargando ? "Creando..." : "Crear usuario"}
          </button>
        </div>
      </div>

      {resultado && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-title">Usuario creado</div>
            <p className="modal-body">Entregá estos datos al cliente. La contraseña no volverá a mostrarse.</p>
            <div className="cred-box">
              <div className="cred-row">
                <div className="cred-key">Empresa</div>
                <div className="cred-val">{resultado.empresa}</div>
              </div>
              <div className="cred-row">
                <div className="cred-key">Usuario</div>
                <div className="cred-val">{resultado.usuario}</div>
              </div>
              <div className="cred-row">
                <div className="cred-key">Contraseña temporal</div>
                <div className="pwd-row">
                  <input className="field-input" readOnly value={resultado.password} />
                  <button className="btn btn-gold" style={{ padding: "0 14px" }} onClick={copiar}>
                    <Copy size={14} />
                  </button>
                </div>
                {copiado && <p style={{ fontSize: ".75rem", color: "var(--green)", marginTop: 6 }}>Copiado</p>}
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn btn-gold" onClick={cerrar}>Aceptar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

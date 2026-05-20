import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  listarConversacionesProveedoresRequest,
  obtenerMensajesProveedorRequest,
  enviarMensajeProveedorRequest,
} from "../services/api";
import "./MensajesProveedores.css";

function ChatImage({ src }: { src: string }) {
  const [hasError, setHasError] = useState(false);

  if (hasError) {
    return (
      <div className="mensaje-imagen-fallback" style={{ padding: "8px", backgroundColor: "#fee2e2", color: "#991b1b", borderRadius: "8px", fontSize: "0.875rem", display: "flex", alignItems: "center", gap: "6px", marginBottom: "6px" }}>
        <span>⚠️ Imagen no disponible</span>
      </div>
    );
  }

  return (
    <img 
      src={src} 
      alt="Adjunto" 
      style={{ maxWidth: "100%", maxHeight: "250px", borderRadius: "8px", cursor: "pointer", display: "block", marginBottom: "6px" }} 
      onError={() => setHasError(true)} 
      onClick={() => window.open(src, "_blank")}
    />
  );
}

function MensajesProveedores() {

  const navigate = useNavigate();
  const [conversaciones, setConversaciones] = useState<any[]>([]);
  const [telefonoActivo, setTelefonoActivo] = useState<string | null>(null);
  const [proveedorActivoNombre, setProveedorActivoNombre] = useState<string>("");
  const [mensajes, setMensajes] = useState<any[]>([]);
  const [nuevoMensaje, setNuevoMensaje] = useState("");
  const [enviando, setEnviando] = useState(false);
  const mensajesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    cargarConversaciones();
    // Opcional: configurar un intervalo para actualizar (polling) si fuera necesario.
  }, []);

  useEffect(() => {
    if (telefonoActivo) {
      cargarMensajes(telefonoActivo);
    }
  }, [telefonoActivo]);

  useEffect(() => {
    scrollToBottom();
  }, [mensajes]);

  const cargarConversaciones = async () => {
    try {
      const data = await listarConversacionesProveedoresRequest();
      if (Array.isArray(data)) {
        setConversaciones(data);
      }
    } catch (error) {
      console.error("Error al cargar conversaciones:", error);
    }
  };

  const cargarMensajes = async (telefono: string) => {
    try {
      const data = await obtenerMensajesProveedorRequest(telefono);
      if (Array.isArray(data)) {
        setMensajes(data);
      }
    } catch (error) {
      console.error("Error al cargar mensajes:", error);
    }
  };

  const seleccionarConversacion = (telefono: string, nombre: string) => {
    setTelefonoActivo(telefono);
    setProveedorActivoNombre(nombre);
  };

  const enviarMensaje = async () => {
    if (!nuevoMensaje.trim() || !telefonoActivo || enviando) return;

    setEnviando(true);
    try {
      const data = await enviarMensajeProveedorRequest(telefonoActivo, nuevoMensaje);
      if (data && data.id) {
        setMensajes((prev) => [...prev, data]);
        setNuevoMensaje("");
        // Actualizar la lista de conversaciones para reflejar el último mensaje enviado
        cargarConversaciones();
      } else {
        alert(data?.detail || "Error al enviar mensaje");
      }
    } catch (error) {
      console.error("Error enviando mensaje:", error);
      alert("Error de conexión al enviar el mensaje.");
    } finally {
      setEnviando(false);
    }
  };

  const scrollToBottom = () => {
    mensajesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      enviarMensaje();
    }
  };

  // Lógica para validar la ventana de 24 horas
  let ventanaExpirada = true;
  let noHayMensajesEntrantes = true;

  if (mensajes.length > 0) {
    // Buscar el último mensaje entrante
    const mensajesEntrantes = mensajes.filter((m) => m.direccion === "entrante");
    if (mensajesEntrantes.length > 0) {
      noHayMensajesEntrantes = false;
      const ultimoEntrante = mensajesEntrantes[mensajesEntrantes.length - 1];
      const fechaUltimo = new Date(ultimoEntrante.fecha_creacion + "Z"); // Asegurar UTC
      const ahora = new Date();
      
      const difMilisegundos = ahora.getTime() - fechaUltimo.getTime();
      const horasPasadas = difMilisegundos / (1000 * 60 * 60);

      if (horasPasadas <= 24) {
        ventanaExpirada = false;
      }
    }
  }

  const formatHora = (fechaString: string) => {
    const d = new Date(fechaString + "Z");
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const formatDate = (fechaString: string) => {
    const d = new Date(fechaString + "Z");
    return d.toLocaleDateString();
  };

  return (
    <div className="mensajes-container">
      {/* Sidebar: Lista de conversaciones */}
      <div className="conversaciones-sidebar">
        <div className="conversaciones-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2>Proveedores</h2>
          <button 
            onClick={() => navigate("/dashboard")}
            style={{ padding: "6px 12px", border: "1px solid #d1d5db", borderRadius: "6px", backgroundColor: "#ffffff", cursor: "pointer", fontSize: "0.875rem", fontWeight: "500", color: "#374151" }}
          >
            Volver
          </button>
        </div>
        <div className="conversaciones-lista">
          {conversaciones.map((conv) => (
            <div
              key={conv.proveedor_id}
              className={`conversacion-item ${telefonoActivo === conv.telefono ? "activa" : ""}`}
              onClick={() => seleccionarConversacion(conv.telefono, conv.nombre)}
            >
              <div className="conversacion-nombre">{conv.nombre}</div>
              <div className="conversacion-telefono">{conv.telefono}</div>
              {conv.ultimo_mensaje && (
                <div className="conversacion-ultimo-mensaje">
                  {conv.ultimo_mensaje.direccion === "saliente" ? "Tú: " : ""}
                  {conv.ultimo_mensaje.tipo === "text" ? conv.ultimo_mensaje.contenido : `[${conv.ultimo_mensaje.tipo}]`}
                  {" • "}
                  {formatDate(conv.fecha_ultimo_mensaje)}
                </div>
              )}
              {!conv.ultimo_mensaje && (
                <div className="conversacion-ultimo-mensaje">
                  Sin mensajes recientes
                </div>
              )}
            </div>
          ))}
          {conversaciones.length === 0 && (
            <div style={{ padding: "20px", textAlign: "center", color: "#6b7280" }}>
              No hay proveedores registrados.
            </div>
          )}
        </div>
      </div>

      {/* Área Principal: Chat */}
      {telefonoActivo ? (
        <div className="chat-area">
          <div className="chat-header">
            <h2>{proveedorActivoNombre}</h2>
          </div>

          {/* Mostrar alerta si la ventana expiró o no hay mensajes entrantes */}
          {(ventanaExpirada || noHayMensajesEntrantes) && (
            <div className="alerta-expirada">
              {noHayMensajesEntrantes 
                ? "No puedes enviar un mensaje libre porque el proveedor aún no ha iniciado una conversación."
                : "La ventana de 24 horas expiró. El proveedor debe escribir nuevamente o debes usar una plantilla aprobada."}
            </div>
          )}

          <div className="chat-mensajes">
            {mensajes.length === 0 ? (
              <div style={{ textAlign: "center", color: "#6b7280", marginTop: "20px" }}>
                No hay mensajes con este proveedor.
              </div>
            ) : (
              mensajes.map((msg, index) => {
                const mostrarFecha = index === 0 || formatDate(mensajes[index - 1].fecha_creacion) !== formatDate(msg.fecha_creacion);
                
                return (
                  <div key={msg.id} style={{ display: 'flex', flexDirection: 'column' }}>
                    {mostrarFecha && (
                      <div style={{ textAlign: 'center', margin: '10px 0', fontSize: '0.8rem', color: '#6b7280' }}>
                        {formatDate(msg.fecha_creacion)}
                      </div>
                    )}
                    <div className={`mensaje ${msg.direccion}`}>
                      <div className="mensaje-contenido">
                        {/* Reply context box — WhatsApp style */}
                        {(msg.reply_to_text || msg.reply_to_media_url) && (
                          <div className="mensaje-reply-container">
                            <div className="mensaje-reply-content">
                              <div className="mensaje-reply-title">Mensaje original</div>
                              <div className="mensaje-reply-text">
                                {msg.reply_to_text || "Imagen"}
                              </div>
                            </div>
                            {msg.reply_to_media_url && (
                              <img
                                className="mensaje-reply-image"
                                src={msg.reply_to_media_url}
                                alt="Producto original"
                                onClick={() => window.open(msg.reply_to_media_url, "_blank")}
                                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                              />
                            )}
                          </div>
                        )}
                        {msg.media_url && <ChatImage src={msg.media_url} />}
                        {msg.contenido && msg.contenido !== "[Mensaje image]" && (
                          <div style={{ wordBreak: "break-word" }}>{msg.contenido}</div>
                        )}
                        {(!msg.contenido || msg.contenido === "[Mensaje image]") && !msg.media_url && (
                          <div>{`[Mensaje tipo: ${msg.tipo}]`}</div>
                        )}
                      </div>
                      <span className="mensaje-fecha">{formatHora(msg.fecha_creacion)}</span>
                    </div>
                  </div>

                );
              })
            )}

            <div ref={mensajesEndRef} />
          </div>

          <div className="chat-input-area">
            <input
              type="text"
              className="chat-input"
              placeholder="Escribe un mensaje..."
              value={nuevoMensaje}
              onChange={(e) => setNuevoMensaje(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={ventanaExpirada || enviando || noHayMensajesEntrantes}
            />
            <button
              className="btn-enviar"
              onClick={enviarMensaje}
              disabled={!nuevoMensaje.trim() || ventanaExpirada || enviando || noHayMensajesEntrantes}
            >
              {enviando ? "..." : "Enviar"}
            </button>
          </div>
        </div>
      ) : (
        <div className="no-chat-seleccionado">
          Selecciona un proveedor para ver los mensajes
        </div>
      )}
    </div>
  );
}

export default MensajesProveedores;

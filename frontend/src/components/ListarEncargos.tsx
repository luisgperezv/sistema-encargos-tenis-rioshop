import { useEffect, useState } from "react";
import {
  listarEncargosRequest,
  actualizarEstadoEncargoRequest,
  agregarAbonoEncargoRequest,
  editarEncargoRequest,
  listarProveedoresRequest,
  subirImagenRequest,
  reenviarEncargoProveedorRequest,
} from "../services/api";

import "./ListarEncargos.css";

const colorEstado = (estado: string) => {
  if (estado === "pendiente") return "rgba(239, 68, 68, 0.05)";
  if (estado === "pedido" || estado === "despachado" || estado === "en_local")
    return "rgba(245, 158, 11, 0.05)";
  if (estado === "entregado") return "rgba(16, 185, 129, 0.05)";
  if (estado === "cancelado") return "rgba(107, 114, 128, 0.05)";
  return "var(--bg-card)";
};

const formatearPesos = (valor: number) => {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(valor);
};

function ListarEncargos() {
  const [encargos, setEncargos] = useState<any[]>([]);
  const [mensaje, setMensaje] = useState("");
  const [abonos, setAbonos] = useState<{ [key: number]: string }>({});
  const [buscar, setBuscar] = useState("");
  const [estadoFiltro, setEstadoFiltro] = useState("");

  const [encargoReenviando, setEncargoReenviando] = useState<number | null>(
    null,
  );
  const [proveedorSeleccionadoReenvio, setProveedorSeleccionadoReenvio] =
    useState<string>("");

  const [encargoEditando, setEncargoEditando] = useState<any | null>(null);
  const [proveedores, setProveedores] = useState<any[]>([]);

  const [editReferencia, setEditReferencia] = useState("");
  const [editTallaCol, setEditTallaCol] = useState("");
  const [editTallaEur, setEditTallaEur] = useState("");
  const [editPrecio, setEditPrecio] = useState("");
  const [editFechaEntrega, setEditFechaEntrega] = useState("");
  const [editObservaciones, setEditObservaciones] = useState("");
  const [editProveedorId, setEditProveedorId] = useState("");
  const [editFoto, setEditFoto] = useState<File | null>(null);

  const [showCostoModal, setShowCostoModal] = useState(false);
  const [modalEncargoId, setModalEncargoId] = useState<number | null>(null);
  const [costoBaseInput, setCostoBaseInput] = useState("");
  const [costoEnvioInput, setCostoEnvioInput] = useState("");
  const [costoDespachadorInput, setCostoDespachadorInput] = useState("");

  const [showCancelacionModal, setShowCancelacionModal] = useState(false);
  const [cancelacionEncargoId, setCancelacionEncargoId] = useState<number | null>(null);
  const [motivoCancelacionInput, setMotivoCancelacionInput] = useState("");
  const [errorCancelacion, setErrorCancelacion] = useState("");

  const totalEncargos = encargos.length;

  const totalPendientes = encargos.filter(
    (encargo) => encargo.estado === "pendiente",
  ).length;

  const totalEnLocal = encargos.filter(
    (encargo) => encargo.estado === "en_local",
  ).length;

  const totalEntregados = encargos.filter(
    (encargo) => encargo.estado === "entregado",
  ).length;

  const saldoTotal = encargos.reduce(
    (total, encargo) => total + Number(encargo.saldo || 0),
    0,
  );

  const cargarEncargos = async () => {
    const data = await listarEncargosRequest(buscar, estadoFiltro);

    if (Array.isArray(data)) {
      setEncargos(data);
    } else {
      setMensaje("❌ Error al cargar encargos");
    }
  };

  const cambiarEstado = async (encargoId: number, nuevoEstado: string) => {
    const respuesta = await actualizarEstadoEncargoRequest(
      encargoId,
      nuevoEstado,
    );

    if (respuesta.id) {
      setEncargos((prev) =>
        prev.map((encargo) => (encargo.id === encargoId ? respuesta : encargo)),
      );
    } else if (respuesta.detail) {
      alert(respuesta.detail);
    } else {
      alert("Error al actualizar estado");
    }
  };

  const handleSelectEstado = (encargo: any, nuevoEstado: string) => {
    if (nuevoEstado === "despachado") {
      setModalEncargoId(encargo.id);
      setCostoBaseInput(encargo.costo_base !== null && encargo.costo_base !== undefined ? String(encargo.costo_base) : "");
      setCostoEnvioInput(encargo.costo_envio !== null && encargo.costo_envio !== undefined ? String(encargo.costo_envio) : "");
      setCostoDespachadorInput(encargo.costo_despachador !== null && encargo.costo_despachador !== undefined ? String(encargo.costo_despachador) : "");
      setShowCostoModal(true);
    } else if (nuevoEstado === "cancelado") {
      setCancelacionEncargoId(encargo.id);
      setMotivoCancelacionInput("");
      setErrorCancelacion("");
      setShowCancelacionModal(true);
    } else if (nuevoEstado === "entregado") {
      const saldo = Number(encargo.saldo || 0);
      const costoTotal = Number(encargo.costo_total || 0);
      if (saldo > 0) {
        alert("⚠️ No se puede entregar un encargo con saldo pendiente.");
        return;
      }
      if (costoTotal <= 0) {
        alert("⚠️ No se puede entregar un encargo sin registrar costos válidos (costo total debe ser mayor a 0).");
        return;
      }
      cambiarEstado(encargo.id, nuevoEstado);
    } else {
      cambiarEstado(encargo.id, nuevoEstado);
    }
  };

  const confirmarDespacho = async () => {
    if (modalEncargoId === null) return;
    
    const costoBase = Number(costoBaseInput);
    const costoEnvio = Number(costoEnvioInput);
    const costoDespachador = Number(costoDespachadorInput);

    if (isNaN(costoBase) || costoBase < 0) {
      alert("⚠️ El costo base debe ser un número mayor o igual a 0");
      return;
    }
    if (isNaN(costoEnvio) || costoEnvio < 0) {
      alert("⚠️ El costo de envío debe ser un número mayor o igual a 0");
      return;
    }
    if (isNaN(costoDespachador) || costoDespachador < 0) {
      alert("⚠️ El costo del despachador debe ser un número mayor o igual a 0");
      return;
    }

    const costos = {
      costo_base: costoBase,
      costo_envio: costoEnvio,
      costo_despachador: costoDespachador,
    };

    const respuesta = await actualizarEstadoEncargoRequest(
      modalEncargoId,
      "despachado",
      costos
    );

    if (respuesta.id) {
      setEncargos((prev) =>
        prev.map((encargo) => (encargo.id === modalEncargoId ? respuesta : encargo)),
      );
      setShowCostoModal(false);
      setModalEncargoId(null);
    } else if (respuesta.detail) {
      alert(respuesta.detail);
    } else {
      alert("Error al despachar el encargo");
    }
  };

  const cancelarModalDespacho = () => {
    setShowCostoModal(false);
    setModalEncargoId(null);
  };

  const confirmarCancelacion = async () => {
    if (cancelacionEncargoId === null) return;
    
    if (!motivoCancelacionInput.trim()) {
      setErrorCancelacion("El motivo de cancelación es obligatorio.");
      return;
    }

    const respuesta = await actualizarEstadoEncargoRequest(
      cancelacionEncargoId,
      "cancelado",
      { motivo_cancelacion: motivoCancelacionInput.trim() }
    );

    if (respuesta.id) {
      setEncargos((prev) =>
        prev.map((encargo) => (encargo.id === cancelacionEncargoId ? respuesta : encargo)),
      );
      setShowCancelacionModal(false);
      setCancelacionEncargoId(null);
      setMotivoCancelacionInput("");
      setErrorCancelacion("");
    } else if (respuesta.detail) {
      setErrorCancelacion(respuesta.detail);
    } else {
      setErrorCancelacion("Error al cancelar el encargo");
    }
  };

  const cancelarModalCancelacion = () => {
    setShowCancelacionModal(false);
    setCancelacionEncargoId(null);
    setMotivoCancelacionInput("");
    setErrorCancelacion("");
  };

  const agregarAbono = async (encargoId: number) => {
    const valor = Number(abonos[encargoId]);

    if (!valor || valor <= 0) {
      alert("Ingresa un abono válido");
      return;
    }

    const respuesta = await agregarAbonoEncargoRequest(encargoId, valor);

    if (respuesta.id) {
      setEncargos((prev) =>
        prev.map((encargo) => (encargo.id === encargoId ? respuesta : encargo)),
      );

      setAbonos((prev) => ({
        ...prev,
        [encargoId]: "",
      }));
    } else if (respuesta.detail) {
      alert(respuesta.detail);
    } else {
      alert("Error al agregar abono");
    }
  };

  const reenviarAlProveedor = async (encargo: any) => {
    const proveedorId = proveedorSeleccionadoReenvio
      ? Number(proveedorSeleccionadoReenvio)
      : undefined;
    const proveedorNombre =
      proveedores.find((p) => p.id === proveedorId)?.nombre ||
      encargo.proveedor?.nombre ||
      "desconocido";

    const confirmar = window.confirm(
      `¿Reenviar el encargo #${encargo.id} al proveedor ${proveedorNombre}?`,
    );

    if (!confirmar) return;

    setMensaje("⏳ Reenviando encargo al proveedor...");

    const respuesta = await reenviarEncargoProveedorRequest(
      encargo.id,
      proveedorId,
    );

    if (respuesta.mensaje) {
      alert("Mensaje reenviado exitosamente");
      setMensaje(`✅ ${respuesta.mensaje}`);
    } else if (respuesta.detail) {
      setMensaje(`❌ ${respuesta.detail}`);
    } else {
      setMensaje("❌ Error al reenviar encargo al proveedor");
    }

    setEncargoReenviando(null);
    setProveedorSeleccionadoReenvio("");
  };

  const abrirEdicion = (encargo: any) => {
    setEncargoEditando(encargo);
    setEditReferencia(encargo.referencia);
    setEditTallaCol(encargo.talla_col);
    setEditTallaEur(encargo.talla_eur);
    setEditPrecio(String(encargo.precio));
    setEditFechaEntrega(encargo.fecha_entrega_estimada || "");
    setEditObservaciones(encargo.observaciones || "");
    setEditProveedorId(
      encargo.proveedor_id ? String(encargo.proveedor_id) : "",
    );
    setEditFoto(null);
  };

  const guardarEdicion = async () => {
    if (!encargoEditando) return;

    if (!editReferencia.trim()) {
      setMensaje("❌ La referencia es obligatoria");
      return;
    }

    if (!editTallaCol.trim()) {
      setMensaje("❌ La talla COL es obligatoria");
      return;
    }

    if (!editTallaEur.trim()) {
      setMensaje("❌ La talla EUR es obligatoria");
      return;
    }

    if (!editPrecio || Number(editPrecio) <= 0) {
      setMensaje("❌ El precio debe ser mayor a 0");
      return;
    }

    let rutaFoto = encargoEditando.foto || null;

    if (editFoto) {
      setMensaje("⏳ Subiendo nueva foto...");

      const imagenSubida = await subirImagenRequest(editFoto);

      if (!imagenSubida.ruta) {
        setMensaje("❌ Error al subir la nueva foto");
        return;
      }

      rutaFoto = imagenSubida.ruta;
    }

    const respuesta = await editarEncargoRequest(encargoEditando.id, {
      proveedor_id: editProveedorId ? Number(editProveedorId) : null,
      referencia: editReferencia,
      talla_col: editTallaCol,
      talla_eur: editTallaEur,
      foto: rutaFoto,
      precio: Number(editPrecio),
      fecha_entrega_estimada: editFechaEntrega || null,
      observaciones: editObservaciones || null,
    });

    if (respuesta.id) {
      setEncargos((prev) =>
        prev.map((encargo) =>
          encargo.id === respuesta.id ? respuesta : encargo,
        ),
      );

      setEncargoEditando(null);
      setEditFoto(null);
      setMensaje("✅ Encargo actualizado correctamente");
    } else if (respuesta.detail) {
      setMensaje(`❌ ${respuesta.detail}`);
    } else {
      setMensaje("❌ Error al actualizar encargo");
    }
  };

  useEffect(() => {
    cargarEncargos();

    const cargarProveedores = async () => {
      const data = await listarProveedoresRequest();

      if (Array.isArray(data)) {
        setProveedores(data);
      }
    };

    cargarProveedores();
  }, []);

  return (
    <div className="encargos-container">
      <h1 className="encargos-title">Listado de Encargos</h1>

      <div className="filtros">
        <input
          placeholder="Buscar por cliente, teléfono, referencia o ID"
          value={buscar}
          onChange={(e) => setBuscar(e.target.value)}
        />

        <select
          value={estadoFiltro}
          onChange={(e) => setEstadoFiltro(e.target.value)}
        >
          <option value="">Todos los estados</option>
          <option value="pendiente">Pendiente</option>
          <option value="pedido">Pedido</option>
          <option value="despachado">Despachado</option>
          <option value="en_local">En local</option>
          <option value="entregado">Entregado</option>
          <option value="cancelado">Cancelado</option>
        </select>

        <button className="btn btn-primary" onClick={cargarEncargos}>
          Buscar
        </button>
      </div>

      <div className="dashboard-resumen">
        <div className="dashboard-card">
          <span>Total</span>
          <strong>{totalEncargos}</strong>
        </div>

        <div className="dashboard-card">
          <span>Pendientes</span>
          <strong>{totalPendientes}</strong>
        </div>

        <div className="dashboard-card">
          <span>En local</span>
          <strong>{totalEnLocal}</strong>
        </div>

        <div className="dashboard-card">
          <span>Entregados</span>
          <strong>{totalEntregados}</strong>
        </div>

        <div className="dashboard-card">
          <span>Saldo por cobrar</span>
          <strong>{formatearPesos(saldoTotal)}</strong>
        </div>
      </div>

      {(buscar.trim() !== "" || estadoFiltro !== "") && encargos.length === 0 && (
        <div className="busqueda-sin-resultados">
          <p className="sin-resultados-principal">🔍 No se encontraron encargos para la búsqueda realizada.</p>
          <p className="sin-resultados-secundario">Verifica los datos ingresados o intenta con otro criterio de búsqueda.</p>
        </div>
      )}

      {mensaje && <p className="mensaje">{mensaje}</p>}

      {encargos.map((encargo) => (
        <div
          key={encargo.id}
          className="card-encargo"
          style={{
            backgroundColor: colorEstado(encargo.estado),
          }}
        >
          <div className="card-header">
            <div>
              <h3>
                #{encargo.id} - {encargo.referencia}
              </h3>

              <span className={`estado-badge estado-${encargo.estado}`}>
                {encargo.estado.replace("_", " ")}
              </span>
            </div>

            {encargo.estado !== "entregado" &&
              encargo.estado !== "cancelado" && (
                <div className="acciones-header">
                  <button
                    className="btn btn-primary"
                    onClick={() => abrirEdicion(encargo)}
                  >
                    Editar
                  </button>

                  <button
                    className="btn btn-danger"
                    onClick={() => handleSelectEstado(encargo, "cancelado")}
                  >
                    Cancelar
                  </button>
                </div>
              )}
          </div>

          {encargoEditando?.id === encargo.id && (
            <div className="editor">
              <h2>Editando encargo #{encargoEditando.id}</h2>

              <div className="editor-grid">
                <div>
                  <label>Proveedor</label>
                  <select
                    value={editProveedorId}
                    onChange={(e) => setEditProveedorId(e.target.value)}
                  >
                    <option value="">Sin proveedor</option>
                    {proveedores.map((proveedor) => (
                      <option key={proveedor.id} value={proveedor.id}>
                        {proveedor.nombre} - {proveedor.telefono}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label>Referencia</label>
                  <input
                    value={editReferencia}
                    onChange={(e) => setEditReferencia(e.target.value)}
                  />
                </div>

                <div>
                  <label>Talla COL</label>
                  <input
                    value={editTallaCol}
                    onChange={(e) => setEditTallaCol(e.target.value)}
                  />
                </div>

                <div>
                  <label>Talla EUR</label>
                  <input
                    value={editTallaEur}
                    onChange={(e) => setEditTallaEur(e.target.value)}
                  />
                </div>

                <div>
                  <label>Precio</label>
                  <input
                    value={editPrecio}
                    onChange={(e) => setEditPrecio(e.target.value)}
                  />
                </div>

                <div>
                  <label>Fecha estimada</label>
                  <input
                    type="date"
                    value={editFechaEntrega}
                    onChange={(e) => setEditFechaEntrega(e.target.value)}
                  />
                </div>

                <div>
                  <label>Observaciones</label>
                  <textarea
                    value={editObservaciones}
                    onChange={(e) => setEditObservaciones(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label>Cambiar foto</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setEditFoto(e.target.files?.[0] || null)}
                />
              </div>

              <div className="acciones">
                <button className="btn btn-primary" onClick={guardarEdicion}>
                  Guardar cambios
                </button>

                <button
                  className="btn btn-secondary"
                  onClick={() => setEncargoEditando(null)}
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}

          <div className="card-body">
            <div className="columna-imagen">
              {encargo.foto && (
                <img
                  src={
                    encargo.foto?.startsWith("http")
                      ? encargo.foto
                      : `${import.meta.env.VITE_API_URL}${encargo.foto}`
                  }
                  alt={encargo.referencia}
                  className="imagen-encargo"
                />
              )}
            </div>

            <div className="columna-info">
              <div className="info-grid">
                <p>
                  <strong>Cliente:</strong> {encargo.cliente?.nombre}
                  {encargo.cliente?.telefono && (
                    <>
                      {" "}
                      — <strong>WhatsApp:</strong> {encargo.cliente.telefono}
                    </>
                  )}
                </p>

                <p>
                  <strong>Proveedor:</strong> {encargo.proveedor?.nombre}
                </p>

                <p>
                  <strong>Talla:</strong> COL {encargo.talla_col} / EUR{" "}
                  {encargo.talla_eur}
                </p>

                <p>
                  <strong>Precio:</strong> {formatearPesos(encargo.precio)}
                </p>

                <p>
                  <strong>Abono:</strong> {formatearPesos(encargo.abono)}
                </p>

                <p>
                  <strong>Saldo:</strong> {formatearPesos(encargo.saldo)}
                </p>

                {Number(encargo.costo_total || 0) > 0 && (
                  <>
                    <p>
                      <strong>Costo Base:</strong> {formatearPesos(Number(encargo.costo_base || 0))}
                    </p>
                    <p>
                      <strong>Costo Envío:</strong> {formatearPesos(Number(encargo.costo_envio || 0))}
                    </p>
                    <p>
                      <strong>Costo Despachador:</strong> {formatearPesos(Number(encargo.costo_despachador || 0))}
                    </p>
                    <p>
                      <strong>Costo Total:</strong> {formatearPesos(Number(encargo.costo_total || 0))}
                    </p>
                    <p>
                      <strong>Utilidad Est.:</strong>{" "}
                      <span style={{ color: Number(encargo.utilidad_estimada || 0) >= 0 ? "#10b981" : "#ef4444", fontWeight: "bold" }}>
                        {formatearPesos(Number(encargo.utilidad_estimada || 0))}
                      </span>
                    </p>
                  </>
                )}

                <p>
                  <strong>Estado:</strong> {encargo.estado}
                </p>

                <p>
                  <strong>Fecha:</strong> {encargo.fecha_creacion}
                </p>

                {encargo.fecha_despacho && (
                  <p>
                    <strong>Fecha Despacho:</strong> {encargo.fecha_despacho}
                  </p>
                )}

                {encargo.fecha_entregado && (
                  <p>
                    <strong>Fecha Entrega:</strong> {encargo.fecha_entregado}
                  </p>
                )}

                {encargo.motivo_cancelacion && (
                  <p>
                    <strong>Motivo Cancelación:</strong> {encargo.motivo_cancelacion}
                  </p>
                )}

                {encargo.fecha_cancelacion && (
                  <p>
                    <strong>Fecha Cancelación:</strong> {encargo.fecha_cancelacion}
                  </p>
                )}
              </div>

              <div className="acciones">
                {encargo.saldo > 0 &&
                  encargo.estado !== "cancelado" &&
                  encargo.estado !== "entregado" && (
                    <>
                      <input
                        placeholder="Nuevo abono"
                        value={abonos[encargo.id] || ""}
                        onChange={(e) =>
                          setAbonos((prev) => ({
                            ...prev,
                            [encargo.id]: e.target.value,
                          }))
                        }
                      />

                      <button
                        className="btn btn-secondary"
                        onClick={() => agregarAbono(encargo.id)}
                      >
                        Agregar abono
                      </button>
                    </>
                  )}

                {(encargo.estado === "pendiente" ||
                  encargo.estado === "pedido") &&
                  (encargoReenviando === encargo.id ? (
                    <div className="reenvio-container">
                      <select
                        value={proveedorSeleccionadoReenvio}
                        onChange={(e) =>
                          setProveedorSeleccionadoReenvio(e.target.value)
                        }
                      >
                        <option value="">
                          {encargo.proveedor
                            ? `Usar asignado (${encargo.proveedor.nombre})`
                            : "Seleccionar proveedor..."}
                        </option>
                        {proveedores.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.nombre}
                          </option>
                        ))}
                      </select>
                      <div className="reenvio-acciones">
                        <button
                          className="btn btn-primary"
                          onClick={() => reenviarAlProveedor(encargo)}
                        >
                          Confirmar
                        </button>
                        <button
                          className="btn btn-secondary"
                          onClick={() => {
                            setEncargoReenviando(null);
                            setProveedorSeleccionadoReenvio("");
                          }}
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      className="btn btn-primary"
                      onClick={() => {
                        setEncargoReenviando(encargo.id);
                        setProveedorSeleccionadoReenvio("");
                      }}
                    >
                      Reenviar a proveedor
                    </button>
                  ))}

                <select
                  value={encargo.estado}
                  onChange={(e) => handleSelectEstado(encargo, e.target.value)}
                >
                  <option value="pendiente">Pendiente</option>
                  <option value="pedido">Pedido</option>
                  <option value="despachado">Despachado</option>
                  <option value="en_local">En local</option>
                  <option 
                    value="entregado" 
                    disabled={Number(encargo.saldo || 0) > 0 || Number(encargo.costo_total || 0) <= 0}
                  >
                    Entregado { (Number(encargo.saldo || 0) > 0 || Number(encargo.costo_total || 0) <= 0) ? "(Bloqueado)" : "" }
                  </option>
                  <option value="cancelado">Cancelado</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      ))}

      {showCostoModal && (
        <div className="costos-modal-overlay">
          <div className="costos-modal-content">
            <h3>Registrar Costos (Encargo #{modalEncargoId})</h3>
            <div className="costos-modal-inputs">
              <div className="modal-campo">
                <label>Costo Base (Bodega):</label>
                <input
                  type="number"
                  placeholder="Ej: 120000"
                  value={costoBaseInput}
                  onChange={(e) => setCostoBaseInput(e.target.value)}
                />
              </div>
              <div className="modal-campo">
                <label>Costo Envío:</label>
                <input
                  type="number"
                  placeholder="Ej: 15000"
                  value={costoEnvioInput}
                  onChange={(e) => setCostoEnvioInput(e.target.value)}
                />
              </div>
              <div className="modal-campo">
                <label>Costo Despachador:</label>
                <input
                  type="number"
                  placeholder="Ej: 5000"
                  value={costoDespachadorInput}
                  onChange={(e) => setCostoDespachadorInput(e.target.value)}
                />
              </div>
            </div>
            <div className="modal-acciones">
              <button className="btn btn-primary" onClick={confirmarDespacho}>
                Confirmar Despacho
              </button>
              <button className="btn btn-secondary" onClick={cancelarModalDespacho}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {showCancelacionModal && (
        <div className="costos-modal-overlay">
          <div className="costos-modal-content">
            <h3>Cancelar Encargo (Encargo #{cancelacionEncargoId})</h3>
            <div className="costos-modal-inputs">
              <div className="modal-campo">
                <label>Motivo de cancelación:</label>
                <textarea
                  placeholder="Escribe el motivo de la cancelación aquí..."
                  value={motivoCancelacionInput}
                  onChange={(e) => {
                    setMotivoCancelacionInput(e.target.value);
                    if (e.target.value.trim()) setErrorCancelacion("");
                  }}
                />
                {errorCancelacion && <p className="error-mensaje">{errorCancelacion}</p>}
              </div>
            </div>
            <div className="modal-acciones">
              <button className="btn btn-danger" onClick={confirmarCancelacion}>
                Confirmar Cancelación
              </button>
              <button className="btn btn-secondary" onClick={cancelarModalCancelacion}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ListarEncargos;

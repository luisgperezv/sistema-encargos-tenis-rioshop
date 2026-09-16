import { useEffect, useState } from "react";
import {
  listarEncargosRequest,
  actualizarEstadoEncargoRequest,
  actualizarCostosEncargoRequest,
  agregarAbonoEncargoRequest,
  editarEncargoRequest,
  listarProveedoresRequest,
  subirImagenRequest,
  reenviarEncargoProveedorRequest,
  reenviarEncargoClienteRequest,
} from "../services/api";

import "./ListarEncargos.css";

// Mapeo oficial de tallas EUR a COL.
// Nota sobre nomenclatura: "D" equivale a Dama/Mujer, "H" equivale a Hombre.
const MAPPING_TALLAS: Record<string, string> = {
  "28": "27",
  "29": "28",
  "30": "29",
  "31": "30",
  "32": "31",
  "33": "32",
  "34": "33",
  "35": "34",
  "36": "35",
  "37": "36",
  "38": "37",
  "39": "38",
  "40D": "39",
  "40H": "38",
  "41D": "40",
  "41H": "39",
  "42": "40",
  "43": "41",
  "44": "42",
  "45": "43",
};

const ORDEN_TALLAS = [
  "28",
  "29",
  "30",
  "31",
  "32",
  "33",
  "34",
  "35",
  "36",
  "37",
  "38",
  "39",
  "40D",
  "40H",
  "41D",
  "41H",
  "42",
  "43",
  "44",
  "45",
];

const OPCIONES_TALLA_EUR = ORDEN_TALLAS;

const colorEstado = (estado: string) => {
  if (estado === "pendiente") return "rgba(239, 68, 68, 0.05)";
  if (estado === "despachado" || estado === "en_local")
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
  const [esEdicionCostos, setEsEdicionCostos] = useState(false);

  const [showCancelacionModal, setShowCancelacionModal] = useState(false);
  const [cancelacionEncargoId, setCancelacionEncargoId] = useState<number | null>(null);
  const [motivoCancelacionInput, setMotivoCancelacionInput] = useState("");
  const [errorCancelacion, setErrorCancelacion] = useState("");

  const [showPagoModal, setShowPagoModal] = useState(false);
  const [pagoEncargoId, setPagoEncargoId] = useState<number | null>(null);
  const [metodoPagoInput, setMetodoPagoInput] = useState("");
  const [errorPago, setErrorPago] = useState("");

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

  // Saldo por cobrar: solo encargos activos (pendiente, despachado, en_local)
  // - Si el filtro es "entregado" o "cancelado", mostrar $0
  // - Si el filtro es uno de los estados activos, sumar solo esos encargos
  // - Sin filtro (todos), sumar solo los activos del listado actual
  const ESTADOS_ACTIVOS = ["pendiente", "despachado", "en_local"];
  const saldoTotal = (() => {
    if (estadoFiltro === "entregado" || estadoFiltro === "cancelado") {
      return 0;
    }
    return encargos
      .filter((encargo) => ESTADOS_ACTIVOS.includes(encargo.estado))
      .reduce((total, encargo) => total + Number(encargo.saldo || 0), 0);
  })();

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
      setEsEdicionCostos(false);
      setShowCostoModal(true);
    } else if (nuevoEstado === "cancelado") {
      setCancelacionEncargoId(encargo.id);
      setMotivoCancelacionInput("");
      setErrorCancelacion("");
      setShowCancelacionModal(true);
    } else if (nuevoEstado === "entregado") {
      if (encargo.estado === "entregado" && encargo.metodo_pago) {
        return;
      }
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
      setPagoEncargoId(encargo.id);
      setMetodoPagoInput(encargo.metodo_pago || "");
      setErrorPago("");
      setShowPagoModal(true);
    } else {
      cambiarEstado(encargo.id, nuevoEstado);
    }
  };

  const abrirModalCostos = (encargo: any) => {
    setModalEncargoId(encargo.id);
    setCostoBaseInput(
      encargo.costo_base !== null && encargo.costo_base !== undefined
        ? String(encargo.costo_base)
        : ""
    );
    setCostoEnvioInput(
      encargo.costo_envio !== null && encargo.costo_envio !== undefined
        ? String(encargo.costo_envio)
        : ""
    );
    setCostoDespachadorInput(
      encargo.costo_despachador !== null && encargo.costo_despachador !== undefined
        ? String(encargo.costo_despachador)
        : ""
    );
    setEsEdicionCostos(true);
    setShowCostoModal(true);
  };

  const guardarCostosDirectos = async () => {
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

    const respuesta = await actualizarCostosEncargoRequest(modalEncargoId, costos);

    if (respuesta.id) {
      setEncargos((prev) =>
        prev.map((encargo) => (encargo.id === modalEncargoId ? respuesta : encargo))
      );
      setShowCostoModal(false);
      setModalEncargoId(null);
      setEsEdicionCostos(false);
      setMensaje("✅ Costos actualizados correctamente sin alterar estado ni fechas");
      setTimeout(() => setMensaje(""), 4000);
    } else if (respuesta.detail) {
      alert(respuesta.detail);
    } else {
      alert("Error al actualizar costos del encargo");
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
      setEsEdicionCostos(false);
    } else if (respuesta.detail) {
      alert(respuesta.detail);
    } else {
      alert("Error al despachar el encargo");
    }
  };

  const cancelarModalDespacho = () => {
    setShowCostoModal(false);
    setModalEncargoId(null);
    setEsEdicionCostos(false);
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

  const confirmarEntrega = async () => {
    if (pagoEncargoId === null) return;

    if (!metodoPagoInput) {
      setErrorPago("El método de pago es obligatorio.");
      return;
    }

    const respuesta = await actualizarEstadoEncargoRequest(
      pagoEncargoId,
      "entregado",
      { metodo_pago: metodoPagoInput }
    );

    if (respuesta.id) {
      setEncargos((prev) =>
        prev.map((encargo) => (encargo.id === pagoEncargoId ? respuesta : encargo)),
      );
      setShowPagoModal(false);
      setPagoEncargoId(null);
      setMetodoPagoInput("");
      setErrorPago("");
    } else if (respuesta.detail) {
      setErrorPago(respuesta.detail);
    } else {
      setErrorPago("Error al entregar el encargo");
    }
  };

  const cancelarModalPago = () => {
    setShowPagoModal(false);
    setPagoEncargoId(null);
    setMetodoPagoInput("");
    setErrorPago("");
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

  const reenviarAlCliente = async (encargo: any) => {
    const clienteNombre = encargo.cliente?.nombre || "desconocido";

    const confirmar = window.confirm(
      `¿Desea reenviar la notificación por WhatsApp del encargo #${encargo.id} al cliente ${clienteNombre}?`
    );

    if (!confirmar) return;

    setMensaje("⏳ Reenviando notificación al cliente...");

    try {
      const respuesta = await reenviarEncargoClienteRequest(encargo.id);

      if (respuesta.mensaje) {
        alert(`✅ ${respuesta.mensaje}`);
        setMensaje(`✅ ${respuesta.mensaje}`);
      } else if (respuesta.detail) {
        alert(`❌ ${respuesta.detail}`);
        setMensaje(`❌ ${respuesta.detail}`);
      } else {
        alert("❌ Error al reenviar notificación al cliente.");
        setMensaje("❌ Error al reenviar notificación al cliente.");
      }
    } catch (error) {
      console.error("Error al reenviar al cliente:", error);
      alert("❌ Error de conexión al intentar reenviar la notificación al cliente.");
      setMensaje("❌ Error de conexión al intentar reenviar al cliente.");
    }
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

      <div className="encargos-grid">
        {encargos.map((encargo) => (
          <div
            key={encargo.id}
            className="card-encargo"
            style={{
              backgroundColor: colorEstado(encargo.estado),
            }}
          >
            {/* 1. FOTO PROTAGONISTA CON BADGE DE ESTADO */}
            <div className="card-foto-wrapper">
              {encargo.foto ? (
                <img
                  src={
                    encargo.foto?.startsWith("http")
                      ? encargo.foto
                      : `${import.meta.env.VITE_API_URL}${encargo.foto}`
                  }
                  alt={encargo.referencia}
                  className="card-foto"
                />
              ) : (
                <div className="card-foto-placeholder">📷 Sin imagen</div>
              )}
              <span className={`estado-badge estado-${encargo.estado} estado-badge-overlay`}>
                {encargo.estado.replace("_", " ")}
              </span>
            </div>

            {/* 2. REFERENCIA E ID + ACCIONES RÁPIDAS DE CABECERA */}
            <div className="card-header">
              <div>
                <h3>
                  #{encargo.id} - {encargo.referencia}
                </h3>
              </div>

              {encargo.estado !== "entregado" &&
                encargo.estado !== "cancelado" && (
                  <div className="acciones-header">
                    <button
                      className="btn btn-primary"
                      title="Editar encargo"
                      onClick={() => abrirEdicion(encargo)}
                    >
                      ✏️
                    </button>

                    <button
                      className="btn btn-danger"
                      title="Cancelar encargo"
                      onClick={() => handleSelectEstado(encargo, "cancelado")}
                    >
                      ❌
                    </button>
                  </div>
                )}
            </div>

            {/* EDITOR EN LÍNEA SI ESTÁ ACTIVO */}
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
                    <label>Talla COL (Auto)</label>
                    <input
                      value={editTallaCol}
                      readOnly
                      style={{ backgroundColor: "#f3f4f6", color: "#374151", cursor: "not-allowed" }}
                    />
                  </div>

                  <div>
                    <label>Talla EUR</label>
                    <select
                      value={editTallaEur}
                      onChange={(e) => {
                        const val = e.target.value;
                        setEditTallaEur(val);
                        setEditTallaCol(MAPPING_TALLAS[val] || "");
                      }}
                    >
                      <option value="">Selecciona talla EUR</option>
                      {OPCIONES_TALLA_EUR.map((size) => (
                        <option key={size} value={size}>
                          {size}
                        </option>
                      ))}
                    </select>
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
              {/* 3. TALLAS COL / EUR */}
              <div className="card-talla-row">
                <span className="talla-badge">COL {encargo.talla_col}</span>
                <span className="talla-badge eur">EUR {encargo.talla_eur}</span>
              </div>

              {/* 4. CLIENTE & PROVEEDOR */}
              <div className="card-persona-info">
                <p title={encargo.cliente?.nombre}>
                  <strong>👤 Cliente:</strong> {encargo.cliente?.nombre || "Sin nombre"}
                </p>
                {encargo.cliente?.telefono && (
                  <p>
                    <strong>💬 WA:</strong>{" "}
                    <a
                      href={`https://wa.me/${encargo.cliente.telefono.replace(/[^0-9]/g, "")}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {encargo.cliente.telefono}
                    </a>
                  </p>
                )}
                <p title={encargo.proveedor?.nombre}>
                  <strong>📦 Prov:</strong> {encargo.proveedor?.nombre || "Sin proveedor"}
                </p>
              </div>

              {/* 5. PRECIO, ABONO Y SALDO */}
              <div className="card-finanzas-grid">
                <div>
                  <span>Precio</span>
                  <strong>{formatearPesos(encargo.precio)}</strong>
                </div>
                <div>
                  <span>Abono</span>
                  <strong>{formatearPesos(encargo.abono)}</strong>
                </div>
                <div className={Number(encargo.saldo) > 0 ? "saldo-destacado" : ""}>
                  <span>Saldo</span>
                  <strong>{formatearPesos(encargo.saldo)}</strong>
                </div>
              </div>

              {/* 6. COSTOS Y UTILIDAD */}
              {Number(encargo.costo_total || 0) > 0 ? (
                <div className="card-costos-box">
                  <div className="costos-mini">
                    <span>Base: ${encargo.costo_base}</span>
                    <span>Env: ${encargo.costo_envio}</span>
                    <span>Desp: ${encargo.costo_despachador}</span>
                  </div>
                  <div className="costo-total-line">
                    <span>C. Total: {formatearPesos(Number(encargo.costo_total || 0))}</span>
                    <span
                      style={{
                        color: Number(encargo.utilidad_estimada || 0) >= 0 ? "#34d399" : "#f87171",
                        fontWeight: "bold",
                      }}
                    >
                      Util: {formatearPesos(Number(encargo.utilidad_estimada || 0))}
                    </span>
                  </div>
                  {encargo.estado !== "cancelado" && (
                    <button
                      className="btn btn-secondary"
                      style={{
                        marginTop: "6px",
                        width: "100%",
                        fontSize: "0.75rem",
                        padding: "4px 8px",
                        background: "rgba(245, 158, 11, 0.15)",
                        border: "1px solid rgba(245, 158, 11, 0.4)",
                        color: "var(--text-primary)",
                      }}
                      title="Modificar costos directos"
                      onClick={() => abrirModalCostos(encargo)}
                    >
                      🏷️ Editar costos
                    </button>
                  )}
                </div>
              ) : (
                encargo.estado !== "cancelado" && (
                  <div style={{ marginBottom: "6px" }}>
                    <button
                      className="btn btn-secondary"
                      style={{
                        width: "100%",
                        fontSize: "0.75rem",
                        padding: "4px 8px",
                        background: "rgba(245, 158, 11, 0.1)",
                        border: "1px dashed rgba(245, 158, 11, 0.3)",
                      }}
                      title="Registrar costos directos"
                      onClick={() => abrirModalCostos(encargo)}
                    >
                      🏷️ Asignar costos
                    </button>
                  </div>
                )
              )}

              {/* FECHAS Y METADATA */}
              <div className="card-fechas-info">
                <span>📅 Creado: {encargo.fecha_creacion}</span>
                {encargo.fecha_entrega_estimada && <span>⏳ Est: {encargo.fecha_entrega_estimada}</span>}
                {encargo.fecha_despacho && <span>🚚 Desp: {encargo.fecha_despacho}</span>}
                {encargo.fecha_entregado && <span>✅ Entregado: {encargo.fecha_entregado}</span>}
                {encargo.metodo_pago && (
                  <span>
                    💳 Pago: <strong className="metodo-pago-tag">{encargo.metodo_pago}</strong>
                  </span>
                )}
                {encargo.motivo_cancelacion && (
                  <span className="txt-danger">❌ Cancel: {encargo.motivo_cancelacion}</span>
                )}
              </div>

              {/* 7. ACCIONES DE ABONO, REENVÍO Y CAMBIO DE ESTADO */}
              <div className="card-acciones">
                {encargo.saldo > 0 &&
                  encargo.estado !== "cancelado" &&
                  encargo.estado !== "entregado" && (
                    <div className="abono-input-row">
                      <input
                        placeholder="Nuevo abono $"
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
                        + Abono
                      </button>
                    </div>
                  )}

                {encargo.estado === "pendiente" &&
                  (encargoReenviando === encargo.id ? (
                    <div className="reenvio-container">
                      <select
                        value={proveedorSeleccionadoReenvio}
                        onChange={(e) => setProveedorSeleccionadoReenvio(e.target.value)}
                      >
                        <option value="">
                          {encargo.proveedor
                            ? `Usar (${encargo.proveedor.nombre})`
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
                          OK
                        </button>
                        <button
                          className="btn btn-secondary"
                          onClick={() => {
                            setEncargoReenviando(null);
                            setProveedorSeleccionadoReenvio("");
                          }}
                        >
                          X
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="acciones-reenvio-grupo">
                      <button
                        className="btn btn-primary"
                        onClick={() => {
                          setEncargoReenviando(encargo.id);
                          setProveedorSeleccionadoReenvio("");
                        }}
                      >
                        <span className="btn-text-full">📲 Reenviar a proveedor</span>
                        <span className="btn-text-mobile">📲 Proveedor</span>
                      </button>
                      <button
                        className="btn btn-secondary"
                        onClick={() => reenviarAlCliente(encargo)}
                      >
                        <span className="btn-text-full">💬 Reenviar a cliente</span>
                        <span className="btn-text-mobile">💬 Cliente</span>
                      </button>
                    </div>
                  ))}

                <select
                  value={encargo.estado}
                  onChange={(e) => handleSelectEstado(encargo, e.target.value)}
                >
                  <option value="pendiente">Pendiente</option>
                  <option value="despachado">Despachado</option>
                  <option value="en_local">En local</option>
                  <option
                    value="entregado"
                    disabled={Number(encargo.saldo || 0) > 0 || Number(encargo.costo_total || 0) <= 0}
                  >
                    Entregado{" "}
                    {Number(encargo.saldo || 0) > 0 || Number(encargo.costo_total || 0) <= 0
                      ? "(Bloqueado)"
                      : ""}
                  </option>
                  <option value="cancelado">Cancelado</option>
                </select>
              </div>
            </div>
          </div>
        ))}
      </div>

      {showCostoModal && (
        <div className="costos-modal-overlay">
          <div className="costos-modal-content">
            <h3>
              {esEdicionCostos
                ? `Modificar Costos (Encargo #${modalEncargoId})`
                : `Registrar Costos de Despacho (Encargo #${modalEncargoId})`}
            </h3>
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
              <div
                className="modal-campo"
                style={{
                  marginTop: "6px",
                  padding: "8px 12px",
                  backgroundColor: "rgba(245, 158, 11, 0.1)",
                  border: "1px dashed rgba(245, 158, 11, 0.3)",
                  borderRadius: "6px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  fontSize: "0.88rem",
                  fontWeight: "bold",
                }}
              >
                <span>Costo Total Calculado:</span>
                <span style={{ color: "#d97706" }}>
                  {formatearPesos(
                    (Number(costoBaseInput) || 0) +
                      (Number(costoEnvioInput) || 0) +
                      (Number(costoDespachadorInput) || 0)
                  )}
                </span>
              </div>
            </div>
            <div className="modal-acciones">
              <button
                className="btn btn-primary"
                onClick={esEdicionCostos ? guardarCostosDirectos : confirmarDespacho}
              >
                {esEdicionCostos ? "Guardar Costos" : "Confirmar Despacho"}
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

      {showPagoModal && (
        <div className="costos-modal-overlay">
          <div className="costos-modal-content">
            <h3>Registrar Método de Pago (Encargo #{pagoEncargoId})</h3>
            <div className="costos-modal-inputs">
              <div className="modal-campo">
                <label>Método de Pago:</label>
                <select
                  value={metodoPagoInput}
                  onChange={(e) => {
                    setMetodoPagoInput(e.target.value);
                    if (e.target.value) setErrorPago("");
                  }}
                >
                  <option value="">Selecciona método de pago...</option>
                  <option value="Efectivo">Efectivo</option>
                  <option value="Transferencia">Transferencia</option>
                  <option value="Tarjeta Débito">Tarjeta Débito</option>
                  <option value="Tarjeta Crédito">Tarjeta Crédito</option>
                  <option value="Addi">Addi</option>
                  <option value="Sistecrédito">Sistecrédito</option>
                </select>
                {errorPago && <p className="error-mensaje">{errorPago}</p>}
              </div>
            </div>
            <div className="modal-acciones">
              <button className="btn btn-primary" onClick={confirmarEntrega}>
                Confirmar Entrega
              </button>
              <button className="btn btn-secondary" onClick={cancelarModalPago}>
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

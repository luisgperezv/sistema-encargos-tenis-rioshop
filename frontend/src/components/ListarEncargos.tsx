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

type InfoWhatsapp = {
  estado: string;
  tipo?: string | null;
  intento?: number | null;
  total_intentos?: number | null;
  error_codigo?: string | null;
  error_mensaje?: string | null;
} | null | undefined;

// "accepted" solo significa que Meta aceptó la solicitud; NO es entrega.
const ESTADOS_WA: Record<string, { texto: string; color: string }> = {
  pendiente: { texto: "Pendiente", color: "#94a3b8" },
  accepted: { texto: "Aceptado", color: "#60a5fa" },
  sent: { texto: "Enviado", color: "#a78bfa" },
  delivered: { texto: "Entregado", color: "#34d399" },
  read: { texto: "Leído", color: "#10b981" },
  failed: { texto: "Fallido", color: "#f87171" },
  incierto: { texto: "Incierto", color: "#fbbf24" },
};

function BadgeWhatsapp({ etiqueta, info }: { etiqueta: string; info: InfoWhatsapp }) {
  const conf = info ? ESTADOS_WA[info.estado] || { texto: info.estado, color: "#94a3b8" } : { texto: "Sin registro", color: "#64748b" };
  const titulo = info
    ? `${etiqueta}: ${conf.texto}${info.tipo ? ` (${info.tipo})` : ""}` +
      `${info.total_intentos ? ` · intentos: ${info.total_intentos}` : ""}` +
      `${info.estado === "failed" ? ` · Error ${info.error_codigo || ""}: ${info.error_mensaje || ""}` : ""}`
    : `${etiqueta}: sin notificaciones registradas (encargo anterior al seguimiento)`;
  return (
    <span
      title={titulo}
      style={{
        fontSize: "0.7rem",
        padding: "2px 8px",
        borderRadius: "999px",
        border: `1px solid ${conf.color}`,
        color: conf.color,
        background: `${conf.color}1a`,
        whiteSpace: "nowrap",
      }}
    >
      💬 {etiqueta}: {conf.texto}
      {info?.estado === "failed" && info.error_codigo ? ` (${info.error_codigo})` : ""}
    </span>
  );
}

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

const OPCIONES_FILTRO_ESTADO = [
  { valor: "", etiqueta: "Todos" },
  { valor: "pendiente", etiqueta: "Pendiente" },
  { valor: "despachado", etiqueta: "Despachado" },
  { valor: "en_local", etiqueta: "En local" },
  { valor: "entregado", etiqueta: "Entregado" },
  { valor: "cancelado", etiqueta: "Cancelado" },
];

const OPCIONES_ESTADO_TARJETA = [
  { valor: "pendiente", etiqueta: "Pendiente" },
  { valor: "despachado", etiqueta: "Despachado" },
  { valor: "en_local", etiqueta: "En local" },
  { valor: "entregado", etiqueta: "Entregado" },
  { valor: "cancelado", etiqueta: "Cancelado" },
];

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
  const [tarjetasExpandidas, setTarjetasExpandidas] = useState<{
    [key: number]: boolean;
  }>({});
  const [cambiandoEstadoIds, setCambiandoEstadoIds] = useState<{
    [key: number]: boolean;
  }>({});
  const [registrandoAbonoIds, setRegistrandoAbonoIds] = useState<{
    [key: number]: boolean;
  }>({});
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

  const cargarEncargos = async (estadoOverride?: string) => {
    const estadoAFiltrar =
      typeof estadoOverride === "string" ? estadoOverride : estadoFiltro;
    const data = await listarEncargosRequest(buscar, estadoAFiltrar);

    if (Array.isArray(data)) {
      setEncargos(data);
    } else {
      setMensaje("❌ Error al cargar encargos");
    }
  };

  const cambiarFiltroEstado = (nuevoEstado: string) => {
    setEstadoFiltro(nuevoEstado);
    cargarEncargos(nuevoEstado);
  };

  const toggleDetallesTarjeta = (encargoId: number) => {
    setTarjetasExpandidas((prev) => ({
      ...prev,
      [encargoId]: !prev[encargoId],
    }));
  };

  const cambiarEstado = async (encargoId: number, nuevoEstado: string) => {
    if (cambiandoEstadoIds[encargoId]) return;
    setCambiandoEstadoIds((prev) => ({ ...prev, [encargoId]: true }));

    try {
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
    } finally {
      setCambiandoEstadoIds((prev) => ({ ...prev, [encargoId]: false }));
    }
  };

  const handleSelectEstado = (encargo: any, nuevoEstado: string) => {
    if (encargo.estado === nuevoEstado) return;
    if (cambiandoEstadoIds[encargo.id]) return;

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

  const obtenerValorInputAbono = (encargo: any): string => {
    const saldoActual = Number(encargo.saldo || 0);
    if (saldoActual <= 0) return "0";
    if (abonos[encargo.id] !== undefined) {
      return abonos[encargo.id];
    }
    return String(saldoActual);
  };

  const agregarAbono = async (encargoId: number) => {
    if (registrandoAbonoIds[encargoId]) return;

    const encargoActual = encargos.find((e) => e.id === encargoId);
    const saldoActual = Number(encargoActual?.saldo || 0);

    if (saldoActual <= 0) {
      alert("El saldo actual es $0. No se permite registrar otro abono.");
      return;
    }

    const textoAbono =
      abonos[encargoId] !== undefined
        ? abonos[encargoId]
        : String(saldoActual);
    const valor = Number(textoAbono);

    if (textoAbono.trim() === "" || isNaN(valor) || valor <= 0) {
      alert("Ingresa un abono válido mayor a $0");
      return;
    }

    if (valor > saldoActual) {
      alert(
        `El abono no puede superar el saldo actual (${formatearPesos(saldoActual)})`,
      );
      return;
    }

    const confirmar = window.confirm(
      `¿Confirmas registrar un abono por ${formatearPesos(valor)}?\nSaldo actual del encargo: ${formatearPesos(saldoActual)}`,
    );

    if (!confirmar) return;

    setRegistrandoAbonoIds((prev) => ({ ...prev, [encargoId]: true }));

    try {
      const respuesta = await agregarAbonoEncargoRequest(encargoId, valor);

      if (respuesta.id) {
        setEncargos((prev) =>
          prev.map((encargo) => (encargo.id === encargoId ? respuesta : encargo)),
        );

        setAbonos((prev) => {
          const copia = { ...prev };
          delete copia[encargoId];
          return copia;
        });
      } else if (respuesta.detail) {
        alert(respuesta.detail);
      } else {
        alert("Error al agregar abono");
      }
    } finally {
      setRegistrandoAbonoIds((prev) => ({ ...prev, [encargoId]: false }));
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
      alert(`✅ ${respuesta.mensaje}`);
      setMensaje(`✅ ${respuesta.mensaje}`);
    } else if (respuesta.detail) {
      setMensaje(`❌ ${respuesta.detail}`);
    } else {
      setMensaje("❌ Error al reenviar encargo al proveedor");
    }

    setEncargoReenviando(null);
    setProveedorSeleccionadoReenvio("");
    await cargarEncargos();
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
    await cargarEncargos();
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
        <div className="filtros-busqueda">
          <input
            placeholder="Buscar por cliente, teléfono, referencia o ID"
            value={buscar}
            onChange={(e) => setBuscar(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                cargarEncargos();
              }
            }}
          />

          <button
            type="button"
            className="btn btn-primary btn-buscar"
            onClick={() => cargarEncargos()}
          >
            Buscar
          </button>
        </div>

        <div
          className="filtros-estados"
          role="group"
          aria-label="Filtrar encargos por estado"
        >
          {OPCIONES_FILTRO_ESTADO.map((opcion) => {
            const activo = estadoFiltro === opcion.valor;
            return (
              <button
                key={opcion.valor || "todos"}
                type="button"
                aria-pressed={activo}
                className={`btn-filtro-estado ${activo ? "activo" : ""}`}
                onClick={() => cambiarFiltroEstado(opcion.valor)}
              >
                {opcion.etiqueta}
              </button>
            );
          })}
        </div>
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
        {encargos.map((encargo) => {
          const saldoActual = Number(encargo.saldo || 0);
          const costoTotalActual = Number(encargo.costo_total || 0);
          const entregaBloqueada = saldoActual > 0 || costoTotalActual <= 0;
          const motivoBloqueoEntrega =
            saldoActual > 0
              ? "No se puede entregar un encargo con saldo pendiente."
              : costoTotalActual <= 0
                ? "No se puede entregar un encargo sin registrar costos válidos (costo total debe ser mayor a 0)."
                : "";
          const estaExpandida = Boolean(tarjetasExpandidas[encargo.id]);
          const permiteAbono =
            saldoActual > 0 &&
            encargo.estado !== "cancelado" &&
            encargo.estado !== "entregado";

          return (
            <div
              key={encargo.id}
              className={`card-encargo ${estaExpandida ? "card-expandida" : ""}`}
              style={{
                backgroundColor: colorEstado(encargo.estado),
              }}
            >
              {/* 1. FOTOGRAFÍA DEL PRODUCTO */}
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
              </div>

              {/* 2. REFERENCIA DEL PRODUCTO (SIN #ID) + 9. EDITAR Y ELIMINAR */}
              <div className="card-header">
                <div className="card-title-wrap">
                  <h3 title={encargo.referencia}>{encargo.referencia}</h3>
                </div>

                {encargo.estado !== "entregado" &&
                  encargo.estado !== "cancelado" && (
                    <div className="acciones-header">
                      <button
                        type="button"
                        className="btn btn-primary"
                        title="Editar encargo"
                        onClick={() => abrirEdicion(encargo)}
                      >
                        ✏️
                      </button>

                      <button
                        type="button"
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
                        style={{
                          backgroundColor: "#f3f4f6",
                          color: "#374151",
                          cursor: "not-allowed",
                        }}
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
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={guardarEdicion}
                    >
                      Guardar cambios
                    </button>

                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => setEncargoEditando(null)}
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}

              <div className="card-body">
                {/* 3. TALLAS Y 4. ESTADO ACTUAL DEL ENCARGO */}
                <div className="card-talla-estado-row">
                  <div className="card-talla-row">
                    <span className="talla-badge eur">EUR {encargo.talla_eur}</span>
                    {encargo.talla_col && (
                      <span className="talla-badge">COL {encargo.talla_col}</span>
                    )}
                  </div>
                  <span className={`estado-badge estado-${encargo.estado}`}>
                    {encargo.estado.replace("_", " ")}
                  </span>
                </div>

                {/* 5. DATOS DEL CLIENTE */}
                <div className="card-persona-info">
                  <p title={encargo.cliente?.nombre}>
                    <strong>Cliente:</strong>{" "}
                    {encargo.cliente?.nombre || "Sin nombre"}
                  </p>
                  <p>
                    <strong>WhatsApp:</strong>{" "}
                    {encargo.cliente?.telefono ? (
                      <a
                        href={`https://wa.me/${encargo.cliente.telefono.replace(/[^0-9]/g, "")}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {encargo.cliente.telefono}
                      </a>
                    ) : (
                      <span>Sin teléfono</span>
                    )}
                  </p>
                </div>

                {/* 6. SALDO */}
                <div
                  className={`card-saldo-box ${
                    saldoActual > 0 ? "saldo-positivo" : "saldo-cero"
                  }`}
                >
                  <span className="card-saldo-label">Saldo</span>
                  <strong className="card-saldo-valor">
                    {saldoActual <= 0 ? "$0" : formatearPesos(saldoActual)}
                  </strong>
                </div>

                {/* 7. REGISTRAR ABONO */}
                {encargo.estado !== "cancelado" && (
                  <div className="abono-input-row">
                    <input
                      type="number"
                      min="1"
                      max={saldoActual > 0 ? saldoActual : 0}
                      placeholder="Abono $"
                      disabled={
                        !permiteAbono || Boolean(registrandoAbonoIds[encargo.id])
                      }
                      value={obtenerValorInputAbono(encargo)}
                      onChange={(e) =>
                        setAbonos((prev) => ({
                          ...prev,
                          [encargo.id]: e.target.value,
                        }))
                      }
                    />

                    <button
                      type="button"
                      className="btn btn-secondary btn-registrar-abono"
                      disabled={
                        !permiteAbono || Boolean(registrandoAbonoIds[encargo.id])
                      }
                      onClick={() => agregarAbono(encargo.id)}
                    >
                      + Abono
                    </button>
                  </div>
                )}

                {/* 8. CAMBIO RÁPIDO DE ESTADO MEDIANTE BOTONES */}
                <div
                  className="card-estados-botones"
                  role="group"
                  aria-label="Cambiar estado del encargo"
                >
                  {OPCIONES_ESTADO_TARJETA.map((op) => {
                    const esEstadoActual = encargo.estado === op.valor;
                    const esEntregadoBloqueado =
                      op.valor === "entregado" &&
                      !esEstadoActual &&
                      entregaBloqueada;

                    return (
                      <button
                        key={op.valor}
                        type="button"
                        aria-pressed={esEstadoActual}
                        aria-disabled={
                          esEntregadoBloqueado ||
                          Boolean(cambiandoEstadoIds[encargo.id])
                        }
                        title={
                          esEntregadoBloqueado
                            ? motivoBloqueoEntrega
                            : `Cambiar estado a ${op.etiqueta}`
                        }
                        className={`btn-estado-card estado-card-${op.valor} ${
                          esEstadoActual ? "activo" : ""
                        } ${esEntregadoBloqueado ? "bloqueado" : ""}`}
                        onClick={() => handleSelectEstado(encargo, op.valor)}
                      >
                        {esEntregadoBloqueado ? `🔒 ${op.etiqueta}` : op.etiqueta}
                      </button>
                    );
                  })}
                </div>

                {/* BOTÓN VER MÁS / VER MENOS DETALLES */}
                <button
                  type="button"
                  className={`btn-ver-detalles ${estaExpandida ? "expandido" : ""}`}
                  aria-expanded={estaExpandida}
                  onClick={() => toggleDetallesTarjeta(encargo.id)}
                >
                  {estaExpandida
                    ? "Ver menos detalles ↑"
                    : "Ver más detalles ↓"}
                </button>

                {/* SECCIÓN EXPANDIBLE: VER MÁS DETALLES */}
                {estaExpandida && (
                  <div className="card-detalles-expandibles">
                    {/* Proveedor */}
                    <div className="detalle-proveedor-box">
                      <p
                        className="detalle-linea"
                        title={encargo.proveedor?.nombre}
                      >
                        <strong>📦 Proveedor:</strong>{" "}
                        {encargo.proveedor?.nombre || "Sin proveedor"}
                      </p>
                      {encargo.proveedor?.telefono && (
                        <p className="detalle-linea">
                          <strong>📞 Tel. Proveedor:</strong>{" "}
                          {encargo.proveedor.telefono}
                        </p>
                      )}
                    </div>

                    {/* Estados de WhatsApp */}
                    <div className="detalle-whatsapp-badges">
                      <BadgeWhatsapp
                        etiqueta="Cliente"
                        info={encargo.whatsapp_cliente}
                      />
                      <BadgeWhatsapp
                        etiqueta="Proveedor"
                        info={encargo.whatsapp_proveedor}
                      />
                    </div>

                    {/* Precio total y Abono acumulado */}
                    <div className="card-finanzas-grid">
                      <div>
                        <span>Precio total</span>
                        <strong>
                          {formatearPesos(Number(encargo.precio || 0))}
                        </strong>
                      </div>
                      <div>
                        <span>Abono acum.</span>
                        <strong>
                          {formatearPesos(Number(encargo.abono || 0))}
                        </strong>
                      </div>
                      <div className={saldoActual > 0 ? "saldo-destacado" : ""}>
                        <span>Saldo</span>
                        <strong>
                          {saldoActual <= 0 ? "$0" : formatearPesos(saldoActual)}
                        </strong>
                      </div>
                    </div>

                    {/* Costos y Utilidad + Botón Asignar/Editar costos */}
                    {costoTotalActual > 0 ? (
                      <div className="card-costos-box">
                        <div className="costos-mini">
                          <span>
                            Base: {formatearPesos(Number(encargo.costo_base || 0))}
                          </span>
                          <span>
                            Envío: {formatearPesos(Number(encargo.costo_envio || 0))}
                          </span>
                          <span>
                            Desp:{" "}
                            {formatearPesos(
                              Number(encargo.costo_despachador || 0),
                            )}
                          </span>
                        </div>
                        <div className="costo-total-line">
                          <span>
                            C. Total: {formatearPesos(costoTotalActual)}
                          </span>
                          <span
                            style={{
                              color:
                                Number(encargo.utilidad_estimada || 0) >= 0
                                  ? "#34d399"
                                  : "#f87171",
                              fontWeight: "bold",
                            }}
                          >
                            Utilidad:{" "}
                            {formatearPesos(
                              Number(encargo.utilidad_estimada || 0),
                            )}
                          </span>
                        </div>
                        {encargo.estado !== "cancelado" && (
                          <button
                            type="button"
                            className="btn btn-secondary btn-costos-accion"
                            title="Modificar costos directos"
                            onClick={() => abrirModalCostos(encargo)}
                          >
                            🏷️ Editar costos
                          </button>
                        )}
                      </div>
                    ) : (
                      encargo.estado !== "cancelado" && (
                        <div className="card-costos-box card-costos-vacio">
                          <div className="costos-mini">
                            <span>Base: $0</span>
                            <span>Envío: $0</span>
                            <span>Desp: $0</span>
                          </div>
                          <div className="costo-total-line">
                            <span>C. Total: $0</span>
                            <span>Utilidad: $0</span>
                          </div>
                          <button
                            type="button"
                            className="btn btn-secondary btn-costos-accion"
                            title="Registrar costos directos"
                            onClick={() => abrirModalCostos(encargo)}
                          >
                            🏷️ Asignar costos
                          </button>
                        </div>
                      )
                    )}

                    {/* Fechas y Metadata adicional */}
                    <div className="card-fechas-info">
                      <span>📅 Creado: {encargo.fecha_creacion}</span>
                      {encargo.fecha_entrega_estimada && (
                        <span>
                          ⏳ Entrega est.: {encargo.fecha_entrega_estimada}
                        </span>
                      )}
                      {encargo.fecha_despacho && (
                        <span>🚚 Despacho: {encargo.fecha_despacho}</span>
                      )}
                      {encargo.fecha_entregado && (
                        <span>✅ Entregado: {encargo.fecha_entregado}</span>
                      )}
                      {encargo.fecha_cancelacion && (
                        <span>🗓️ Cancelado: {encargo.fecha_cancelacion}</span>
                      )}
                      {encargo.metodo_pago && (
                        <span>
                          💳 Pago:{" "}
                          <strong className="metodo-pago-tag">
                            {encargo.metodo_pago}
                          </strong>
                        </span>
                      )}
                      {encargo.motivo_cancelacion && (
                        <span className="txt-danger">
                          ❌ Cancelación: {encargo.motivo_cancelacion}
                        </span>
                      )}
                      {encargo.observaciones && (
                        <span>📝 Obs.: {encargo.observaciones}</span>
                      )}
                    </div>

                    {/* Botones de reenvío a proveedor y cliente */}
                    {encargo.estado === "pendiente" &&
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
                              type="button"
                              className="btn btn-primary"
                              onClick={() => reenviarAlProveedor(encargo)}
                            >
                              OK
                            </button>
                            <button
                              type="button"
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
                            type="button"
                            className="btn btn-primary"
                            onClick={() => {
                              setEncargoReenviando(encargo.id);
                              setProveedorSeleccionadoReenvio("");
                            }}
                          >
                            <span className="btn-text-full">
                              📲 Reenviar a proveedor
                            </span>
                            <span className="btn-text-mobile">📲 Proveedor</span>
                          </button>
                          <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={() => reenviarAlCliente(encargo)}
                          >
                            <span className="btn-text-full">
                              💬 Reenviar a cliente
                            </span>
                            <span className="btn-text-mobile">💬 Cliente</span>
                          </button>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
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

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { listarOperacionesPOSRequest } from "../../services/api";
import type {
  VentaOperacionListItem,
  HistorialVentasKPIs,
} from "../../services/api";
import { DetalleVentaModal } from "./DetalleVentaModal";
import {
  Search,
  ShoppingCart,
  Filter,
  DollarSign,
  TrendingUp,
  Package,
  Layers,
  Eye,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  ReceiptText,
  AlertCircle,
  Ban,
} from "lucide-react";
import "./HistorialVentas.css";


const formatearPesos = (valor: number | undefined | null) => {
  const v = valor || 0;
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(v);
};

const formatearFechaHora = (fechaStr?: string | null) => {
  if (!fechaStr) return "-";
  if (/^\d{4}-\d{2}-\d{2}$/.test(fechaStr)) {
    const [y, m, d] = fechaStr.split("-");
    const meses = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
    return `${d} ${meses[parseInt(m, 10) - 1]} ${y}`;
  }
  try {
    const d = new Date(fechaStr);
    if (isNaN(d.getTime())) return fechaStr;
    return new Intl.DateTimeFormat("es-CO", {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
      timeZone: "America/Bogota",
    }).format(d);
  } catch {
    return fechaStr;
  }
};

const METODOS_PAGO = [
  "Todos",
  "Efectivo",
  "Transferencia",
  "Tarjeta Débito",
  "Tarjeta Crédito",
  "Addi",
  "Sistecrédito",
];

// Helper para fechas canónicas en horario de Colombia
const obtenerRangoPeriodo = (tipo: string): { desde: string; hasta: string } => {
  // Obtener fecha actual en UTC-5
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const nowCO = new Date(utc - 3600000 * 5);

  const y = nowCO.getFullYear();
  const m = nowCO.getMonth();
  const d = nowCO.getDate();

  const toStr = (date: Date) => {
    const dy = date.getFullYear();
    const dm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    return `${dy}-${dm}-${dd}`;
  };

  if (tipo === "hoy") {
    const s = toStr(nowCO);
    return { desde: s, hasta: s };
  } else if (tipo === "semana") {
    // Lunes de esta semana
    const dayOfWeek = nowCO.getDay(); // 0 dom, 1 lun, ...
    const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const lunes = new Date(y, m, d + diffToMonday);
    const domingo = new Date(y, m, d + diffToMonday + 6);
    return { desde: toStr(lunes), hasta: toStr(domingo) };
  } else if (tipo === "mes") {
    const primerDia = new Date(y, m, 1);
    const ultimoDia = new Date(y, m + 1, 0);
    return { desde: toStr(primerDia), hasta: toStr(ultimoDia) };
  }

  return { desde: "", hasta: "" };
};

export const HistorialVentas = () => {

  // Filtros
  const [periodo, setPeriodo] = useState<"mes" | "hoy" | "semana" | "todo" | "custom">("mes");
  const [fechaDesde, setFechaDesde] = useState<string>(() => obtenerRangoPeriodo("mes").desde);
  const [fechaHasta, setFechaHasta] = useState<string>(() => obtenerRangoPeriodo("mes").hasta);
  const [metodoPago, setMetodoPago] = useState<string>("Todos");
  const [filtroEstado, setFiltroEstado] = useState<string>("Todos");
  const [buscar, setBuscar] = useState<string>("");
  const [buscarDebounced, setBuscarDebounced] = useState<string>("");

  // Paginación
  const [pagina, setPagina] = useState<number>(1);
  const limite = 25;

  // Datos
  const [items, setItems] = useState<VentaOperacionListItem[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [kpis, setKpis] = useState<HistorialVentasKPIs>({
    total_transacciones: 0,
    unidades_vendidas: 0,
    total_cobrado: 0,
    costos_directos: 0,
    utilidad_bruta: 0,
  });
  const [cargando, setCargando] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Modal de Detalle
  const [modalOperacionId, setModalOperacionId] = useState<number | null>(null);
  const [modalEsLegacy, setModalEsLegacy] = useState<boolean>(false);

  // Debounce para búsqueda
  useEffect(() => {
    const timer = setTimeout(() => {
      setBuscarDebounced(buscar);
      setPagina(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [buscar]);

  // Manejar cambio de período
  const handleCambioPeriodo = (nuevoPeriodo: "mes" | "hoy" | "semana" | "todo" | "custom") => {
    setPeriodo(nuevoPeriodo);
    setPagina(1);
    if (nuevoPeriodo === "custom") {
      // Mantiene las fechas que tenga
    } else {
      const rango = obtenerRangoPeriodo(nuevoPeriodo);
      setFechaDesde(rango.desde);
      setFechaHasta(rango.hasta);
    }
  };

  // Cargar datos
  const cargarHistorial = async () => {
    setCargando(true);
    setError(null);
    try {
      const offset = (pagina - 1) * limite;
      const res = await listarOperacionesPOSRequest({
        fecha_desde: fechaDesde || undefined,
        fecha_hasta: fechaHasta || undefined,
        metodo_pago: metodoPago === "Todos" ? undefined : metodoPago,
        estado: filtroEstado === "Todos" ? undefined : filtroEstado.toLowerCase(),
        buscar: buscarDebounced.trim() || undefined,
        limit: limite,
        offset: offset,
      });

      if ((res as any).detail) {
        setError(typeof (res as any).detail === "string" ? (res as any).detail : "Error al cargar historial");
      } else {
        setItems(res.items || []);
        setTotal(res.total || 0);
        if (res.kpis) {
          setKpis({
            total_transacciones: res.kpis.total_transacciones || 0,
            unidades_vendidas: res.kpis.unidades_vendidas || 0,
            total_cobrado: Number(res.kpis.total_cobrado) || 0,
            costos_directos: Number(res.kpis.costos_directos) || 0,
            utilidad_bruta: Number(res.kpis.utilidad_bruta) || 0,
          });
        }
      }
    } catch (err: any) {
      setError(err.message || "Error al conectar con el servidor");
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarHistorial();
  }, [fechaDesde, fechaHasta, metodoPago, filtroEstado, buscarDebounced, pagina]);

  const totalPaginas = Math.ceil(total / limite) || 1;

  const handleResetFiltros = () => {
    setPeriodo("mes");
    const r = obtenerRangoPeriodo("mes");
    setFechaDesde(r.desde);
    setFechaHasta(r.hasta);
    setMetodoPago("Todos");
    setFiltroEstado("Todos");
    setBuscar("");
    setBuscarDebounced("");
    setPagina(1);
  };

  const abrirDetalle = (opId: number, esLegacy: boolean) => {
    setModalOperacionId(opId);
    setModalEsLegacy(esLegacy);
  };

  const cerrarDetalle = () => {
    setModalOperacionId(null);
  };

  return (
    <div className="hv-container">
      {/* Cabecera Principal */}
      <div className="hv-header-row">
        <div>
          <div className="hv-badge-seccion">
            <ReceiptText size={16} /> Caja Diaria
          </div>
          <h1 className="hv-page-title">Historial de Ventas POS</h1>
          <p className="hv-page-subtitle">
            Consulta y auditoría de transacciones realizadas en caja y ventas directas
          </p>
        </div>
        <div className="hv-header-actions">
          <Link to="/dashboard/pos" className="hv-btn-nueva-venta">
            <ShoppingCart size={18} />
            <span>Nueva Venta</span>
          </Link>
        </div>
      </div>

      {/* Banner de KPIs Globales */}
      <div className="hv-kpis-grid">
        <div className="hv-kpi-card">
          <div className="hv-kpi-header">
            <span className="hv-kpi-label">Transacciones</span>
            <div className="hv-kpi-icon-wrap hv-icon-blue">
              <Layers size={18} />
            </div>
          </div>
          <div className="hv-kpi-num">{kpis.total_transacciones}</div>
          <div className="hv-kpi-subtext">Ventas registradas</div>
        </div>

        <div className="hv-kpi-card">
          <div className="hv-kpi-header">
            <span className="hv-kpi-label">Pares Vendidos</span>
            <div className="hv-kpi-icon-wrap hv-icon-purple">
              <Package size={18} />
            </div>
          </div>
          <div className="hv-kpi-num">{kpis.unidades_vendidas}</div>
          <div className="hv-kpi-subtext">Unidades entregadas</div>
        </div>

        <div className="hv-kpi-card hv-card-cobrado">
          <div className="hv-kpi-header">
            <span className="hv-kpi-label">Total Cobrado</span>
            <div className="hv-kpi-icon-wrap hv-icon-green">
              <DollarSign size={18} />
            </div>
          </div>
          <div className="hv-kpi-num hv-text-cobrado">
            {formatearPesos(kpis.total_cobrado)}
          </div>
          <div className="hv-kpi-subtext">Ingresos por ventas de caja</div>
        </div>

        <div className="hv-kpi-card">
          <div className="hv-kpi-header">
            <span className="hv-kpi-label">Costos Directos</span>
            <div className="hv-kpi-icon-wrap hv-icon-orange">
              <TrendingUp size={18} />
            </div>
          </div>
          <div className="hv-kpi-num hv-text-costo">
            {formatearPesos(kpis.costos_directos)}
          </div>
          <div className="hv-kpi-subtext">Costo de inventario vendido</div>
        </div>

        <div className="hv-kpi-card hv-card-utilidad">
          <div className="hv-kpi-header">
            <span className="hv-kpi-label">Utilidad Bruta</span>
            <div className="hv-kpi-icon-wrap hv-icon-emerald">
              <TrendingUp size={18} />
            </div>
          </div>
          <div className="hv-kpi-num hv-text-utilidad">
            {formatearPesos(kpis.utilidad_bruta)}
          </div>
          <div className="hv-kpi-subtext">Margen bruto en ventas POS</div>
        </div>
      </div>

      {/* Barra de Filtros */}
      <div className="hv-filtros-card">
        <div className="hv-filtros-top">
          {/* Píldoras de Período */}
          <div className="hv-periodos-pills">
            <button
              type="button"
              className={`hv-pill ${periodo === "hoy" ? "hv-pill-active" : ""}`}
              onClick={() => handleCambioPeriodo("hoy")}
            >
              Hoy
            </button>
            <button
              type="button"
              className={`hv-pill ${periodo === "semana" ? "hv-pill-active" : ""}`}
              onClick={() => handleCambioPeriodo("semana")}
            >
              Semana
            </button>
            <button
              type="button"
              className={`hv-pill ${periodo === "mes" ? "hv-pill-active" : ""}`}
              onClick={() => handleCambioPeriodo("mes")}
            >
              Este Mes
            </button>
            <button
              type="button"
              className={`hv-pill ${periodo === "todo" ? "hv-pill-active" : ""}`}
              onClick={() => handleCambioPeriodo("todo")}
            >
              Todo
            </button>
            <button
              type="button"
              className={`hv-pill ${periodo === "custom" ? "hv-pill-active" : ""}`}
              onClick={() => handleCambioPeriodo("custom")}
            >
              Personalizado
            </button>
          </div>

          {/* Reset Filtros */}
          <button
            type="button"
            className="hv-btn-limpiar"
            onClick={handleResetFiltros}
            title="Restablecer filtros"
          >
            <RotateCcw size={15} />
            <span>Restablecer</span>
          </button>
        </div>

        {/* Fechas personalizadas si está seleccionado 'custom' */}
        {periodo === "custom" && (
          <div className="hv-custom-fechas-row">
            <div className="hv-fecha-field">
              <label>Desde:</label>
              <input
                type="date"
                value={fechaDesde}
                onChange={(e) => {
                  setFechaDesde(e.target.value);
                  setPagina(1);
                }}
                className="hv-input-date"
              />
            </div>
            <div className="hv-fecha-field">
              <label>Hasta:</label>
              <input
                type="date"
                value={fechaHasta}
                onChange={(e) => {
                  setFechaHasta(e.target.value);
                  setPagina(1);
                }}
                className="hv-input-date"
              />
            </div>
          </div>
        )}

        {/* Buscador y Método de Pago */}
        <div className="hv-controles-row">
          <div className="hv-search-wrap">
            <Search size={18} className="hv-search-icon" />
            <input
              type="text"
              placeholder="Buscar por # venta, cliente, teléfono..."
              value={buscar}
              onChange={(e) => setBuscar(e.target.value)}
              className="hv-search-input"
            />
            {buscar && (
              <button
                type="button"
                className="hv-search-clear"
                onClick={() => setBuscar("")}
                title="Limpiar búsqueda"
              >
                ✕
              </button>
            )}
          </div>

          <div className="hv-select-wrap">
            <Filter size={16} className="hv-select-icon" />
            <select
              value={metodoPago}
              onChange={(e) => {
                setMetodoPago(e.target.value);
                setPagina(1);
              }}
              className="hv-select"
            >
              {METODOS_PAGO.map((m) => (
                <option key={m} value={m}>
                  {m === "Todos" ? "Todos los métodos" : m}
                </option>
              ))}
            </select>
          </div>

          <div className="hv-select-wrap">
            <Filter size={16} className="hv-select-icon" />
            <select
              value={filtroEstado}
              onChange={(e) => {
                setFiltroEstado(e.target.value);
                setPagina(1);
              }}
              className="hv-select"
            >
              <option value="Todos">Todos los estados</option>
              <option value="completada">Completadas</option>
              <option value="anulada">Anuladas</option>
            </select>
          </div>
        </div>
      </div>

      {/* Lista / Tabla de Transacciones */}
      <div className="hv-tabla-container">
        {cargando ? (
          <div className="hv-loading-state">
            <div className="hv-spinner"></div>
            <p>Consultando transacciones...</p>
          </div>
        ) : error ? (
          <div className="hv-error-state">
            <AlertCircle size={32} />
            <p>{error}</p>
            <button className="hv-btn-secundario" onClick={cargarHistorial}>
              Reintentar
            </button>
          </div>
        ) : items.length === 0 ? (
          <div className="hv-empty-state">
            <Package size={42} className="hv-empty-icon" />
            <h3>No se encontraron transacciones</h3>
            <p>
              No hay ventas que coincidan con los filtros seleccionados. Prueba cambiando el rango de fechas o limpiando la búsqueda.
            </p>
            <button className="hv-btn-secundario" onClick={handleResetFiltros}>
              Ver todas las del mes
            </button>
          </div>
        ) : (
          <>
            {/* Tabla para Desktop */}
            <div className="hv-table-responsive">
              <table className="hv-tabla">
                <thead>
                  <tr>
                    <th># Venta</th>
                    <th>Fecha / Hora</th>
                    <th>Cliente</th>
                    <th className="hv-text-center">Unidades</th>
                    <th>Método de Pago</th>
                    <th className="hv-text-right">Total Cobrado</th>
                    <th className="hv-text-right">Utilidad Bruta</th>
                    <th className="hv-text-center">Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it) => {
                    const anulada = it.estado === "anulada";
                    return (
                      <tr
                        key={`${it.es_legacy ? 'leg' : 'pos'}-${it.id}`}
                        className={anulada ? "hv-row-anulada" : ""}
                      >
                        <td>
                          <div className="hv-ticket-col">
                            <span className="hv-ticket-num">{it.numero_venta}</span>
                            {anulada && (
                              <span className="hv-badge-anulada">
                                <Ban size={11} /> ANULADA
                              </span>
                            )}
                            {it.es_legacy && (
                              <span className="hv-ticket-tag-legacy">Directa</span>
                            )}
                          </div>
                        </td>
                        <td className="hv-fecha-col">
                          {formatearFechaHora(it.fecha_venta)}
                        </td>
                        <td>
                          <div className="hv-cliente-col">
                            <span className="hv-cliente-nombre">
                              {it.cliente_nombre || "Cliente casual"}
                            </span>
                            {it.cliente_telefono && (
                              <span className="hv-cliente-tel">{it.cliente_telefono}</span>
                            )}
                          </div>
                        </td>
                        <td className="hv-text-center">
                          <span className="hv-unidades-badge">
                            {it.cantidad_items} {it.cantidad_items === 1 ? "par" : "pares"}
                          </span>
                        </td>
                        <td>
                          <span className="hv-metodo-pill">
                            {it.metodo_pago || "Efectivo"}
                          </span>
                        </td>
                        <td className="hv-text-right hv-font-semibold hv-text-cobrado">
                          {formatearPesos(it.total_bruto)}
                        </td>
                        <td className="hv-text-right hv-font-semibold hv-text-utilidad">
                          {formatearPesos(it.utilidad_total)}
                        </td>
                        <td className="hv-text-center">
                          <button
                            type="button"
                            className="hv-btn-detalle"
                            onClick={() => abrirDetalle(it.id, it.es_legacy)}
                            title="Ver detalle de la venta"
                          >
                            <Eye size={15} />
                            <span>Detalle</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Cards para Móvil */}
            <div className="hv-mobile-cards-list">
              {items.map((it) => {
                const anulada = it.estado === "anulada";
                return (
                  <div
                    key={`m-${it.es_legacy ? 'leg' : 'pos'}-${it.id}`}
                    className={`hv-card-movil ${anulada ? "hv-card-anulada" : ""}`}
                    onClick={() => abrirDetalle(it.id, it.es_legacy)}
                  >
                    <div className="hv-card-movil-header">
                      <div className="hv-card-movil-ticket">
                        <span className="hv-ticket-num">{it.numero_venta}</span>
                        {anulada && (
                          <span className="hv-badge-anulada">
                            <Ban size={11} /> ANULADA
                          </span>
                        )}
                        {it.es_legacy && (
                          <span className="hv-ticket-tag-legacy">Directa</span>
                        )}
                      </div>
                      <span className="hv-card-movil-fecha">
                        {formatearFechaHora(it.fecha_venta)}
                      </span>
                    </div>

                    <div className="hv-card-movil-body">
                      <div className="hv-card-movil-cliente">
                        <span className="hv-cliente-nombre">
                          {it.cliente_nombre || "Cliente casual"}
                        </span>
                        {it.cliente_telefono && (
                          <span className="hv-cliente-tel">{it.cliente_telefono}</span>
                        )}
                      </div>
                      <div className="hv-card-movil-meta">
                        <span className="hv-metodo-pill">{it.metodo_pago || "Efectivo"}</span>
                        <span className="hv-unidades-badge">
                          {it.cantidad_items} {it.cantidad_items === 1 ? "par" : "pares"}
                        </span>
                      </div>
                    </div>

                    <div className="hv-card-movil-footer">
                      <div>
                        <span className="hv-card-footer-label">Total Cobrado:</span>
                        <span className="hv-card-footer-val hv-text-cobrado">
                          {formatearPesos(it.total_bruto)}
                        </span>
                      </div>
                      <div className="hv-text-right">
                        <span className="hv-card-footer-label">Utilidad Bruta:</span>
                        <span className="hv-card-footer-val hv-text-utilidad">
                          {formatearPesos(it.utilidad_total)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Controles de Paginación */}
            <div className="hv-paginacion-bar">
              <div className="hv-paginacion-info">
                Mostrando{" "}
                <span className="hv-font-semibold">
                  {total === 0 ? 0 : (pagina - 1) * limite + 1}
                </span>{" "}
                a{" "}
                <span className="hv-font-semibold">
                  {Math.min(pagina * limite, total)}
                </span>{" "}
                de <span className="hv-font-semibold">{total}</span> transacciones
              </div>

              <div className="hv-paginacion-botones">
                <button
                  type="button"
                  className="hv-btn-pag"
                  disabled={pagina <= 1}
                  onClick={() => setPagina((p) => Math.max(p - 1, 1))}
                >
                  <ChevronLeft size={16} />
                  <span>Anterior</span>
                </button>
                <span className="hv-pag-actual">
                  Página {pagina} de {totalPaginas}
                </span>
                <button
                  type="button"
                  className="hv-btn-pag"
                  disabled={pagina >= totalPaginas}
                  onClick={() => setPagina((p) => Math.min(p + 1, totalPaginas))}
                >
                  <span>Siguiente</span>
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Modal de Detalle */}
      {modalOperacionId !== null && (
        <DetalleVentaModal
          operacionId={modalOperacionId}
          esLegacy={modalEsLegacy}
          onClose={cerrarDetalle}
          onOperacionAnulada={cargarHistorial}
        />
      )}
    </div>
  );
};
export default HistorialVentas;

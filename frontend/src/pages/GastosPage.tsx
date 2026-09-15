import { useState, useEffect, useCallback } from "react";
import Layout from "../components/Layout";
import FormularioGasto from "../components/Gastos/FormularioGasto";
import TablaGastos from "../components/Gastos/TablaGastos";
import {
  getGastos,
  getResumenGastos,
  crearGasto,
  editarGasto,
  eliminarGasto,
  type Gasto,
  type GastoForm,
  type GastoResumen,
  type GastoFiltros,
} from "../services/gastos";
import "../components/Gastos/Gastos.css";
import { PlusCircle, DollarSign, Receipt, TrendingUp, AlertTriangle } from "lucide-react";

const CATEGORIAS = [
  "Publicidad",
  "Arriendo",
  "Servicios",
  "Personal",
  "Medias",
  "Empaques",
  "Transporte",
  "Mantenimiento",
  "Software",
  "Impuestos",
  "Otros",
];

const formatearCOP = (valor: number): string => {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(valor);
};

export default function GastosPage() {
  const [gastos, setGastos] = useState<Gasto[]>([]);
  const [resumen, setResumen] = useState<GastoResumen | null>(null);
  const [cargando, setCargando] = useState<boolean>(true);
  const [guardando, setGuardando] = useState<boolean>(false);
  const [modalFormularioAbierto, setModalFormularioAbierto] = useState<boolean>(false);
  const [gastoSeleccionado, setGastoSeleccionado] = useState<Gasto | null>(null);
  const [gastoAEliminar, setGastoAEliminar] = useState<Gasto | null>(null);
  const [mensajeExito, setMensajeExito] = useState<string | null>(null);

  // Filtros
  const [fechaDesde, setFechaDesde] = useState<string>("");
  const [fechaHasta, setFechaHasta] = useState<string>("");
  const [categoriaFiltro, setCategoriaFiltro] = useState<string>("");

  const cargarDatos = useCallback(async () => {
    setCargando(true);
    try {
      const filtros: GastoFiltros = {};
      if (fechaDesde) filtros.fecha_desde = fechaDesde;
      if (fechaHasta) filtros.fecha_hasta = fechaHasta;
      if (categoriaFiltro) filtros.categoria = categoriaFiltro;

      const [gastosData, resumenData] = await Promise.all([
        getGastos(filtros),
        getResumenGastos(filtros),
      ]);
      setGastos(gastosData);
      setResumen(resumenData);
    } catch (err: any) {
      console.error("Error al cargar gastos:", err);
    } finally {
      setCargando(false);
    }
  }, [fechaDesde, fechaHasta, categoriaFiltro]);

  useEffect(() => {
    cargarDatos();
  }, [cargarDatos]);

  const mostrarMensajeTemporal = (msg: string) => {
    setMensajeExito(msg);
    setTimeout(() => setMensajeExito(null), 3500);
  };

  const handleAbrirCrear = () => {
    setGastoSeleccionado(null);
    setModalFormularioAbierto(true);
  };

  const handleAbrirEditar = (gasto: Gasto) => {
    setGastoSeleccionado(gasto);
    setModalFormularioAbierto(true);
  };

  const handleGuardar = async (data: GastoForm) => {
    setGuardando(true);
    try {
      if (gastoSeleccionado) {
        await editarGasto(gastoSeleccionado.id, data);
        mostrarMensajeTemporal("Gasto actualizado exitosamente.");
      } else {
        await crearGasto(data);
        mostrarMensajeTemporal("Gasto registrado exitosamente.");
      }
      setModalFormularioAbierto(false);
      setGastoSeleccionado(null);
      await cargarDatos();
    } finally {
      setGuardando(false);
    }
  };

  const handleConfirmarEliminar = async () => {
    if (!gastoAEliminar) return;
    setGuardando(true);
    try {
      await eliminarGasto(gastoAEliminar.id);
      mostrarMensajeTemporal("Gasto eliminado correctamente.");
      setGastoAEliminar(null);
      await cargarDatos();
    } catch (err: any) {
      alert(err?.message || "Error al eliminar el gasto");
    } finally {
      setGuardando(false);
    }
  };

  const handleLimpiarFiltros = () => {
    setFechaDesde("");
    setFechaHasta("");
    setCategoriaFiltro("");
  };

  const topCategoria = resumen?.por_categoria && resumen.por_categoria.length > 0
    ? resumen.por_categoria[0]
    : null;

  return (
    <Layout>
      <div className="gastos-container">
        {/* Cabecera */}
        <div className="gastos-header">
          <div className="gastos-header-titles">
            <h1>Gastos Operativos</h1>
            <p>Control de egresos generales del negocio (no incluye costos directos de encargos)</p>
          </div>
          <button
            type="button"
            className="gastos-btn-nuevo"
            onClick={handleAbrirCrear}
          >
            <PlusCircle size={18} />
            <span>Registrar Gasto</span>
          </button>
        </div>

        {mensajeExito && (
          <div className="gastos-alert-exito" style={{
            background: "rgba(16, 185, 129, 0.15)",
            border: "1px solid rgba(16, 185, 129, 0.3)",
            color: "#6ee7b7",
            padding: "0.75rem 1rem",
            borderRadius: "8px",
            marginBottom: "1rem",
            fontSize: "0.9rem"
          }}>
            {mensajeExito}
          </div>
        )}

        {/* Tarjetas de Resumen */}
        <div className="gastos-resumen-grid">
          <div className="gastos-resumen-card">
            <div className="gastos-resumen-icon gastos-icon-total">
              <DollarSign size={24} />
            </div>
            <div className="gastos-resumen-info">
              <span>Total Gastos del Período</span>
              <h2>{formatearCOP(resumen?.total_gastos || 0)}</h2>
              <small>Egresos operativos del negocio</small>
            </div>
          </div>

          <div className="gastos-resumen-card">
            <div className="gastos-resumen-icon gastos-icon-cantidad">
              <Receipt size={24} />
            </div>
            <div className="gastos-resumen-info">
              <span>Cantidad de Gastos</span>
              <h2>{resumen?.cantidad_gastos || 0}</h2>
              <small>Registros en el período</small>
            </div>
          </div>

          <div className="gastos-resumen-card">
            <div className="gastos-resumen-icon gastos-icon-top">
              <TrendingUp size={24} />
            </div>
            <div className="gastos-resumen-info">
              <span>Categoría Principal</span>
              <h2>{topCategoria ? topCategoria.categoria : "Sin datos"}</h2>
              <small>
                {topCategoria
                  ? `${formatearCOP(topCategoria.total)} (${topCategoria.cantidad} gastos)`
                  : "0 gastos"}
              </small>
            </div>
          </div>
        </div>

        {/* Filtros */}
        <div className="gastos-filtros-bar">
          <div className="gastos-filtro-item">
            <label htmlFor="filtro-desde">Desde</label>
            <input
              id="filtro-desde"
              type="date"
              value={fechaDesde}
              onChange={(e) => setFechaDesde(e.target.value)}
            />
          </div>

          <div className="gastos-filtro-item">
            <label htmlFor="filtro-hasta">Hasta</label>
            <input
              id="filtro-hasta"
              type="date"
              value={fechaHasta}
              onChange={(e) => setFechaHasta(e.target.value)}
            />
          </div>

          <div className="gastos-filtro-item">
            <label htmlFor="filtro-categoria">Categoría</label>
            <select
              id="filtro-categoria"
              value={categoriaFiltro}
              onChange={(e) => setCategoriaFiltro(e.target.value)}
            >
              <option value="">Todas las categorías</option>
              {CATEGORIAS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {(fechaDesde || fechaHasta || categoriaFiltro) && (
            <button
              type="button"
              className="gastos-btn-limpiar"
              onClick={handleLimpiarFiltros}
            >
              Limpiar Filtros
            </button>
          )}
        </div>

        {/* Listado / Tabla */}
        {cargando ? (
          <div className="gastos-empty-state">
            <p>Cargando información de gastos...</p>
          </div>
        ) : (
          <TablaGastos
            gastos={gastos}
            onEditar={handleAbrirEditar}
            onEliminar={(gasto) => setGastoAEliminar(gasto)}
          />
        )}

        {/* Modal Formulario Crear / Editar */}
        {modalFormularioAbierto && (
          <FormularioGasto
            gastoEditar={gastoSeleccionado}
            onGuardar={handleGuardar}
            onCerrar={() => {
              setModalFormularioAbierto(false);
              setGastoSeleccionado(null);
            }}
            cargando={guardando}
          />
        )}

        {/* Modal Confirmar Eliminación */}
        {gastoAEliminar && (
          <div className="gastos-modal-backdrop" onClick={() => setGastoAEliminar(null)}>
            <div className="gastos-modal-content gastos-confirm-modal" onClick={(e) => e.stopPropagation()}>
              <div className="gastos-modal-header">
                <h3 style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <AlertTriangle color="#ef4444" size={20} />
                  <span>Eliminar Gasto</span>
                </h3>
              </div>
              <div className="gastos-confirm-body">
                <p>
                  ¿Estás seguro de que deseas eliminar este gasto registrado?
                </p>
                <p>
                  <strong>{gastoAEliminar.descripcion}</strong> por{" "}
                  <strong>{formatearCOP(gastoAEliminar.valor)}</strong> ({gastoAEliminar.fecha}).
                </p>
                <small style={{ color: "#ef4444" }}>Esta acción no se puede deshacer.</small>
              </div>
              <div className="gastos-modal-footer">
                <button
                  type="button"
                  className="gastos-btn-cancelar"
                  onClick={() => setGastoAEliminar(null)}
                  disabled={guardando}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className="gastos-btn-confirm-delete"
                  onClick={handleConfirmarEliminar}
                  disabled={guardando}
                >
                  {guardando ? "Eliminando..." : "Sí, eliminar"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}

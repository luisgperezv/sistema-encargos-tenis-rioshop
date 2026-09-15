import { useState, useEffect, useCallback } from "react";
import Layout from "../components/Layout";
import ResumenFiltros from "../components/Resumen/ResumenFiltros";
import ResumenKpis from "../components/Resumen/ResumenKpis";
import ResumenGraficos from "../components/Resumen/ResumenGraficos";
import ResumenPanelOperativo from "../components/Resumen/ResumenPanelOperativo";
import { getResumenFinanciero, type ResumenFinancieroResponse } from "../services/resumen";
import "../components/Resumen/Resumen.css";

export default function DashboardPage() {
  const [data, setData] = useState<ResumenFinancieroResponse | null>(null);
  const [cargando, setCargando] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filtros (Por defecto "mes")
  const [periodo, setPeriodo] = useState<string>("mes");
  const [fechaDesde, setFechaDesde] = useState<string>("");
  const [fechaHasta, setFechaHasta] = useState<string>("");

  const cargarResumen = useCallback(async (p: string, desde?: string, hasta?: string) => {
    setCargando(true);
    setError(null);
    try {
      const resp = await getResumenFinanciero(p, desde, hasta);
      setData(resp);
    } catch (err: any) {
      console.error("Error al cargar dashboard:", err);
      setError(err?.message || "No se pudo cargar la información del Dashboard");
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargarResumen(periodo);
  }, [cargarResumen, periodo]);

  const handleCambiarPeriodo = (nuevoPeriodo: string) => {
    setPeriodo(nuevoPeriodo);
    if (nuevoPeriodo !== "personalizado") {
      cargarResumen(nuevoPeriodo);
    }
  };

  const handleAplicarPersonalizado = () => {
    if (!fechaDesde || !fechaHasta) {
      alert("Por favor selecciona ambas fechas (Desde y Hasta)");
      return;
    }
    cargarResumen("personalizado", fechaDesde, fechaHasta);
  };

  return (
    <Layout>
      <div className="resumen-container">
        {/* Cabecera del Dashboard */}
        <div className="resumen-header">
          <div className="resumen-header-titles">
            <h1>Dashboard Financiero</h1>
            <p>Centro de control de ingresos, costos, gastos y pedidos en curso de Tenis Rio Shop</p>
          </div>
          {data?.filtros && (
            <div className="periodo-actual-badge">
              <span>
                {data.filtros.fecha_desde && data.filtros.fecha_hasta
                  ? `${data.filtros.fecha_desde} al ${data.filtros.fecha_hasta}`
                  : "Histórico Total"}
              </span>
            </div>
          )}
        </div>

        {/* Barra de Filtros */}
        <ResumenFiltros
          periodoActual={periodo}
          fechaDesde={fechaDesde}
          fechaHasta={fechaHasta}
          onCambiarPeriodo={handleCambiarPeriodo}
          onCambiarFechaDesde={setFechaDesde}
          onCambiarFechaHasta={setFechaHasta}
          onAplicarPersonalizado={handleAplicarPersonalizado}
        />

        {error && (
          <div className="gastos-alert-error">
            <span>{error}</span>
          </div>
        )}

        {cargando && !data ? (
          <div className="gastos-empty-state">
            <p>Calculando métricas financieras y estado operacional...</p>
          </div>
        ) : data ? (
          <>
            {/* 1. Tarjetas KPI Financieras */}
            <ResumenKpis data={data.financiero} />

            {/* 2. Gráficos Estratégicos */}
            <ResumenGraficos data={data.graficos} />

            {/* 3. Panel Operativo en Vivo */}
            <ResumenPanelOperativo data={data.operacional_en_vivo} />
          </>
        ) : null}
      </div>
    </Layout>
  );
}

const API = import.meta.env.VITE_API_URL ?? "";

function authHeaders() {
  const token = localStorage.getItem("token");
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export interface DetalleOrigenVenta {
  transacciones: number;
  pares_vendidos: number;
  ingresos: number;
  costos_directos: number;
  utilidad_bruta: number;
}

export interface DesgloseOrigen {
  encargos: DetalleOrigenVenta;
  pos: DetalleOrigenVenta;
}

export interface MetricasFinancieras {
  ingresos_totales: number;
  costos_directos: number;
  utilidad_bruta: number;
  margen_bruto: number;
  gastos_operativos: number;
  utilidad_neta: number;
  margen_neto: number;
  transacciones_totales: number;
  pares_vendidos: number;
  ticket_promedio: number;
  desglose_origen: DesgloseOrigen;
}

export interface DetalleEstadoOperativo {
  cantidad: number;
  valor_comprometido: number;
  abonos_recibidos: number;
  saldo_por_cobrar: number;
  utilidad_proyectada: number;
  con_costo: number;
}

export interface PanelOperativo {
  pendientes: DetalleEstadoOperativo;
  despachados: DetalleEstadoOperativo;
  en_local: DetalleEstadoOperativo;
  total_activos: number;
  abonos_recibidos_activos: number;
  saldo_por_cobrar_activos: number;
  utilidad_proyectada_total: number;
  cobertura_costos_activos: string;
}

export interface ItemFlujoFinanciero {
  etiqueta: string;
  valor: number;
  tipo: string;
}

export interface ItemGastoCategoria {
  categoria: string;
  total: number;
  porcentaje: number;
}

export interface GraficosResumen {
  flujo_financiero: ItemFlujoFinanciero[];
  gastos_por_categoria: ItemGastoCategoria[];
}

export interface FiltrosResumen {
  periodo: string;
  fecha_desde: string | null;
  fecha_hasta: string | null;
}

export interface ResumenFinancieroResponse {
  filtros: FiltrosResumen;
  financiero: MetricasFinancieras;
  operacional_en_vivo: PanelOperativo;
  graficos: GraficosResumen;
}

export async function getResumenFinanciero(
  periodo: string = "mes",
  fechaDesde?: string,
  fechaHasta?: string
): Promise<ResumenFinancieroResponse> {
  const params = new URLSearchParams();
  params.set("periodo", periodo);
  if (fechaDesde) params.set("fecha_desde", fechaDesde);
  if (fechaHasta) params.set("fecha_hasta", fechaHasta);

  const res = await fetch(`${API}/resumen/financiero?${params.toString()}`, {
    headers: authHeaders(),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData?.detail || `Error ${res.status} al cargar el resumen`);
  }

  return res.json() as Promise<ResumenFinancieroResponse>;
}

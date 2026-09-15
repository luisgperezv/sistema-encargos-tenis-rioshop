from pydantic import BaseModel
from typing import Optional, List


class DetalleOrigenVenta(BaseModel):
    transacciones: int
    pares_vendidos: int
    ingresos: int
    costos_directos: int
    utilidad_bruta: int


class DesgloseOrigen(BaseModel):
    encargos: DetalleOrigenVenta
    pos: DetalleOrigenVenta


class MetricasFinancieras(BaseModel):
    ingresos_totales: int
    costos_directos: int
    utilidad_bruta: int
    margen_bruto: float
    gastos_operativos: int
    utilidad_neta: int
    margen_neto: float
    transacciones_totales: int
    pares_vendidos: int
    ticket_promedio: int
    desglose_origen: DesgloseOrigen


class DetalleEstadoOperativo(BaseModel):
    cantidad: int
    valor_comprometido: int
    abonos_recibidos: int
    saldo_por_cobrar: int
    utilidad_proyectada: int
    con_costo: int


class PanelOperativo(BaseModel):
    pendientes: DetalleEstadoOperativo
    despachados: DetalleEstadoOperativo
    en_local: DetalleEstadoOperativo
    total_activos: int
    abonos_recibidos_activos: int
    saldo_por_cobrar_activos: int
    utilidad_proyectada_total: int
    cobertura_costos_activos: str


class ItemFlujoFinanciero(BaseModel):
    etiqueta: str
    valor: int
    tipo: str  # 'ingreso' | 'costo' | 'utilidad_bruta' | 'gasto' | 'utilidad_neta'


class ItemGastoCategoria(BaseModel):
    categoria: str
    total: int
    porcentaje: float


class GraficosResumen(BaseModel):
    flujo_financiero: List[ItemFlujoFinanciero]
    gastos_por_categoria: List[ItemGastoCategoria]


class FiltrosResumen(BaseModel):
    periodo: str
    fecha_desde: Optional[str]
    fecha_hasta: Optional[str]


class ResumenFinancieroResponse(BaseModel):
    filtros: FiltrosResumen
    financiero: MetricasFinancieras
    operacional_en_vivo: PanelOperativo
    graficos: GraficosResumen

from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text, or_
from typing import Optional
from datetime import datetime, date, timedelta, timezone

from app.core.security import get_current_user
from app.database import get_db
from app.models.encargo import Encargo
from app.models.venta_operacion import VentaOperacion
from app.models.venta import Venta
from app.models.gasto import Gasto
from app.schemas.resumen import (
    ResumenFinancieroResponse,
    FiltrosResumen,
    MetricasFinancieras,
    DesgloseOrigen,
    DetalleOrigenVenta,
    PanelOperativo,
    DetalleEstadoOperativo,
    GraficosResumen,
    ItemFlujoFinanciero,
    ItemGastoCategoria,
)

router = APIRouter()

# Colombia no maneja cambio de horario; es permanentemente UTC-5
ZONA_COLOMBIA = timezone(timedelta(hours=-5))


def calcular_rango_fechas(
    periodo: str,
    fecha_desde_param: Optional[str] = None,
    fecha_hasta_param: Optional[str] = None,
) -> tuple[Optional[str], Optional[str], str]:
    """
    Calcula fechas 'YYYY-MM-DD' en hora local de Colombia.
    Retorna (fecha_desde, fecha_hasta, periodo_normalizado).
    """
    ahora_co = datetime.now(ZONA_COLOMBIA)
    hoy_str = ahora_co.strftime("%Y-%m-%d")
    hoy_date = ahora_co.date()

    p = periodo.lower().strip() if periodo else "mes"

    if p == "hoy":
        return hoy_str, hoy_str, "hoy"

    elif p == "semana":
        # Lunes a domingo de la semana actual
        lunes = hoy_date - timedelta(days=hoy_date.weekday())
        domingo = lunes + timedelta(days=6)
        return lunes.strftime("%Y-%m-%d"), domingo.strftime("%Y-%m-%d"), "semana"

    elif p == "mes":
        # Primer día y último día del mes actual
        primer_dia = hoy_date.replace(day=1)
        # Siguiente mes menos 1 día
        if primer_dia.month == 12:
            siguiente_mes = primer_dia.replace(year=primer_dia.year + 1, month=1, day=1)
        else:
            siguiente_mes = primer_dia.replace(month=primer_dia.month + 1, day=1)
        ultimo_dia = siguiente_mes - timedelta(days=1)
        return primer_dia.strftime("%Y-%m-%d"), ultimo_dia.strftime("%Y-%m-%d"), "mes"

    elif p == "anio":
        primer_dia_anio = hoy_date.replace(month=1, day=1)
        ultimo_dia_anio = hoy_date.replace(month=12, day=31)
        return primer_dia_anio.strftime("%Y-%m-%d"), ultimo_dia_anio.strftime("%Y-%m-%d"), "anio"

    elif p == "historico":
        return None, None, "historico"

    elif p == "personalizado":
        if not fecha_desde_param or not fecha_hasta_param:
            raise HTTPException(
                status_code=400,
                detail="Para período personalizado debes proporcionar fecha_desde y fecha_hasta (YYYY-MM-DD)",
            )
        if fecha_desde_param > fecha_hasta_param:
            raise HTTPException(
                status_code=400,
                detail="fecha_desde no puede ser posterior a fecha_hasta",
            )
        return fecha_desde_param, fecha_hasta_param, "personalizado"

    else:
        # Por defecto mes
        primer_dia = hoy_date.replace(day=1)
        if primer_dia.month == 12:
            siguiente_mes = primer_dia.replace(year=primer_dia.year + 1, month=1, day=1)
        else:
            siguiente_mes = primer_dia.replace(month=primer_dia.month + 1, day=1)
        ultimo_dia = siguiente_mes - timedelta(days=1)
        return primer_dia.strftime("%Y-%m-%d"), ultimo_dia.strftime("%Y-%m-%d"), "mes"


@router.get("/resumen/financiero", response_model=ResumenFinancieroResponse)
def obtener_resumen_financiero(
    periodo: str = Query("mes", description="hoy | semana | mes | anio | historico | personalizado"),
    fecha_desde: Optional[str] = Query(None),
    fecha_hasta: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: str = Depends(get_current_user),
):
    """
    Retorna el estado financiero consolidado del negocio (sin doble conteo)
    para el período seleccionado, junto al panel operativo en tiempo real.
    """
    f_desde, f_hasta, periodo_norm = calcular_rango_fechas(periodo, fecha_desde, fecha_hasta)

    # ──────────────────────────────────────────────────────────────────────────
    # 1. VENTAS REALES POR ENCARGOS ENTREGADOS (Fuente canónica: tabla encargos)
    # ──────────────────────────────────────────────────────────────────────────
    q_enc = db.query(Encargo).filter(Encargo.estado == "entregado")
    if f_desde and f_hasta:
        q_enc = q_enc.filter(Encargo.fecha_entregado >= f_desde, Encargo.fecha_entregado <= f_hasta)

    encargos_entregados = q_enc.all()

    enc_trans = len(encargos_entregados)
    enc_pares = enc_trans  # 1 par por encargo
    enc_ingresos = sum(int(round(e.precio or 0)) for e in encargos_entregados)
    enc_costos = sum(int(round(e.costo_total or 0)) for e in encargos_entregados)
    enc_utilidad = enc_ingresos - enc_costos

    # ──────────────────────────────────────────────────────────────────────────
    # 2. VENTAS REALES POS
    #    A) Operaciones agrupadas (tabla: venta_operaciones)
    #    B) Ventas directas sin operacion_id (tabla: ventas con origen='inventario')
    # ──────────────────────────────────────────────────────────────────────────
    # 2A. venta_operaciones (excluyendo operaciones anuladas)
    # Convertimos fecha_venta a string YYYY-MM-DD en zona horaria Colombia
    q_ops = db.query(VentaOperacion).filter(
        or_(VentaOperacion.estado != "anulada", VentaOperacion.estado.is_(None))
    )
    ops_all = q_ops.all()

    ops_filtradas = []
    for op in ops_all:
        if op.fecha_venta:
            # fecha_venta es timestamp without time zone en UTC
            dt_utc = op.fecha_venta.replace(tzinfo=timezone.utc)
            dt_co = dt_utc.astimezone(ZONA_COLOMBIA)
            op_fecha_str = dt_co.strftime("%Y-%m-%d")
        else:
            op_fecha_str = None

        if f_desde and f_hasta:
            if op_fecha_str and f_desde <= op_fecha_str <= f_hasta:
                ops_filtradas.append(op)
        else:
            ops_filtradas.append(op)

    pos_ops_trans = len(ops_filtradas)
    pos_ops_pares = sum(op.cantidad_items or 1 for op in ops_filtradas)
    pos_ops_ingresos = sum(int(round(float(op.total_bruto or 0))) for op in ops_filtradas)
    pos_ops_costos = sum(int(round(float(op.costo_total or 0))) for op in ops_filtradas)
    pos_ops_util = sum(int(round(float(op.utilidad_total or 0))) for op in ops_filtradas)

    # 2B. ventas directas sin operacion_id (excluyendo ventas anuladas)
    q_v_dir = db.query(Venta).filter(
        Venta.origen == "inventario",
        Venta.operacion_id == None,
        or_(Venta.estado != "anulada", Venta.estado.is_(None)),
    )
    if f_desde and f_hasta:
        q_v_dir = q_v_dir.filter(Venta.fecha_venta >= f_desde, Venta.fecha_venta <= f_hasta)

    ventas_dir = q_v_dir.all()
    pos_dir_trans = len(ventas_dir)
    pos_dir_pares = sum(v.cantidad or 1 for v in ventas_dir)
    pos_dir_ingresos = sum(int(round(v.subtotal or v.precio_venta or 0)) for v in ventas_dir)
    pos_dir_costos = sum(int(round(v.costo_total or 0)) for v in ventas_dir)
    pos_dir_util = sum(int(round(v.utilidad or (pos_dir_ingresos - pos_dir_costos))) for v in ventas_dir)

    # Consolidado POS
    pos_trans_tot = pos_ops_trans + pos_dir_trans
    pos_pares_tot = pos_ops_pares + pos_dir_pares
    pos_ingresos_tot = pos_ops_ingresos + pos_dir_ingresos
    pos_costos_tot = pos_ops_costos + pos_dir_costos
    pos_util_tot = pos_ops_util + pos_dir_util

    # ──────────────────────────────────────────────────────────────────────────
    # 3. GASTOS OPERATIVOS DEL PERÍODO (Fuente canónica: tabla gastos)
    # ──────────────────────────────────────────────────────────────────────────
    q_gastos = db.query(Gasto)
    if f_desde and f_hasta:
        q_gastos = q_gastos.filter(Gasto.fecha >= f_desde, Gasto.fecha <= f_hasta)

    gastos_periodo = q_gastos.all()
    total_gastos = sum(g.valor for g in gastos_periodo)

    # Agrupación de gastos por categoría para gráficos
    cat_totales: dict[str, int] = {}
    for g in gastos_periodo:
        cat_totales[g.categoria] = cat_totales.get(g.categoria, 0) + g.valor

    gastos_cat_items = []
    for cat, val in sorted(cat_totales.items(), key=lambda x: -x[1]):
        pct = (val / total_gastos * 100.0) if total_gastos > 0 else 0.0
        gastos_cat_items.append(
            ItemGastoCategoria(categoria=cat, total=val, porcentaje=round(pct, 2))
        )

    # ──────────────────────────────────────────────────────────────────────────
    # 4. CONSOLIDADO FINANCIERO (Ventas Realizadas − Costos − Gastos)
    # ──────────────────────────────────────────────────────────────────────────
    ingresos_totales = enc_ingresos + pos_ingresos_tot
    costos_directos = enc_costos + pos_costos_tot
    utilidad_bruta = ingresos_totales - costos_directos
    margen_bruto = (utilidad_bruta / ingresos_totales * 100.0) if ingresos_totales > 0 else 0.0

    utilidad_neta = utilidad_bruta - total_gastos
    margen_neto = (utilidad_neta / ingresos_totales * 100.0) if ingresos_totales > 0 else 0.0

    transacciones_totales = enc_trans + pos_trans_tot
    pares_vendidos = enc_pares + pos_pares_tot
    ticket_promedio = int(round(ingresos_totales / transacciones_totales)) if transacciones_totales > 0 else 0

    financiero = MetricasFinancieras(
        ingresos_totales=ingresos_totales,
        costos_directos=costos_directos,
        utilidad_bruta=utilidad_bruta,
        margen_bruto=round(margen_bruto, 2),
        gastos_operativos=total_gastos,
        utilidad_neta=utilidad_neta,
        margen_neto=round(margen_neto, 2),
        transacciones_totales=transacciones_totales,
        pares_vendidos=pares_vendidos,
        ticket_promedio=ticket_promedio,
        desglose_origen=DesgloseOrigen(
            encargos=DetalleOrigenVenta(
                transacciones=enc_trans,
                pares_vendidos=enc_pares,
                ingresos=enc_ingresos,
                costos_directos=enc_costos,
                utilidad_bruta=enc_utilidad,
            ),
            pos=DetalleOrigenVenta(
                transacciones=pos_trans_tot,
                pares_vendidos=pos_pares_tot,
                ingresos=pos_ingresos_tot,
                costos_directos=pos_costos_tot,
                utilidad_bruta=pos_util_tot,
            ),
        ),
    )

    # ──────────────────────────────────────────────────────────────────────────
    # 5. PANEL OPERATIVO EN VIVO (Métricas de Encargos Activos)
    #    No se mezclan con ventas realizadas
    # ──────────────────────────────────────────────────────────────────────────
    activos = db.query(Encargo).filter(
        Encargo.estado.in_(["pendiente", "despachado", "en_local"])
    ).all()

    grupos_act = {
        "pendiente": {"cant": 0, "comp": 0, "abono": 0, "saldo": 0, "util_proy": 0, "con_costo": 0},
        "despachado": {"cant": 0, "comp": 0, "abono": 0, "saldo": 0, "util_proy": 0, "con_costo": 0},
        "en_local": {"cant": 0, "comp": 0, "abono": 0, "saldo": 0, "util_proy": 0, "con_costo": 0},
    }

    for a in activos:
        est = a.estado
        if est in grupos_act:
            pr = int(round(a.precio or 0))
            ab = int(round(a.abono or 0))
            sal = int(round(a.saldo or 0))
            grupos_act[est]["cant"] += 1
            grupos_act[est]["comp"] += pr
            grupos_act[est]["abono"] += ab
            grupos_act[est]["saldo"] += sal

            if a.costo_total and a.costo_total > 0:
                grupos_act[est]["con_costo"] += 1
                c_tot = int(round(a.costo_total))
                grupos_act[est]["util_proy"] += (pr - c_tot)

    tot_act_cant = len(activos)
    tot_abonos_act = sum(g["abono"] for g in grupos_act.values())
    tot_saldo_act = sum(g["saldo"] for g in grupos_act.values())
    tot_util_proy = sum(g["util_proy"] for g in grupos_act.values())
    tot_con_costo = sum(g["con_costo"] for g in grupos_act.values())

    panel_op = PanelOperativo(
        pendientes=DetalleEstadoOperativo(
            cantidad=grupos_act["pendiente"]["cant"],
            valor_comprometido=grupos_act["pendiente"]["comp"],
            abonos_recibidos=grupos_act["pendiente"]["abono"],
            saldo_por_cobrar=grupos_act["pendiente"]["saldo"],
            utilidad_proyectada=grupos_act["pendiente"]["util_proy"],
            con_costo=grupos_act["pendiente"]["con_costo"],
        ),
        despachados=DetalleEstadoOperativo(
            cantidad=grupos_act["despachado"]["cant"],
            valor_comprometido=grupos_act["despachado"]["comp"],
            abonos_recibidos=grupos_act["despachado"]["abono"],
            saldo_por_cobrar=grupos_act["despachado"]["saldo"],
            utilidad_proyectada=grupos_act["despachado"]["util_proy"],
            con_costo=grupos_act["despachado"]["con_costo"],
        ),
        en_local=DetalleEstadoOperativo(
            cantidad=grupos_act["en_local"]["cant"],
            valor_comprometido=grupos_act["en_local"]["comp"],
            abonos_recibidos=grupos_act["en_local"]["abono"],
            saldo_por_cobrar=grupos_act["en_local"]["saldo"],
            utilidad_proyectada=grupos_act["en_local"]["util_proy"],
            con_costo=grupos_act["en_local"]["con_costo"],
        ),
        total_activos=tot_act_cant,
        abonos_recibidos_activos=tot_abonos_act,
        saldo_por_cobrar_activos=tot_saldo_act,
        utilidad_proyectada_total=tot_util_proy,
        cobertura_costos_activos=f"{tot_con_costo}/{tot_act_cant}",
    )

    # ──────────────────────────────────────────────────────────────────────────
    # 6. GRÁFICOS ESTRATÉGICOS (Máximo 2)
    #    1) Cascada de flujo financiero
    #    2) Desglose de gastos por categoría
    # ──────────────────────────────────────────────────────────────────────────
    flujo_items = [
        ItemFlujoFinanciero(etiqueta="Ventas Realizadas", valor=ingresos_totales, tipo="ingreso"),
        ItemFlujoFinanciero(etiqueta="Costos Directos", valor=costos_directos, tipo="costo"),
        ItemFlujoFinanciero(etiqueta="Utilidad Bruta", valor=utilidad_bruta, tipo="utilidad_bruta"),
        ItemFlujoFinanciero(etiqueta="Gastos Operativos", valor=total_gastos, tipo="gasto"),
        ItemFlujoFinanciero(etiqueta="Utilidad Neta", valor=utilidad_neta, tipo="utilidad_neta"),
    ]

    graficos = GraficosResumen(
        flujo_financiero=flujo_items,
        gastos_por_categoria=gastos_cat_items,
    )

    return ResumenFinancieroResponse(
        filtros=FiltrosResumen(
            periodo=periodo_norm,
            fecha_desde=f_desde,
            fecha_hasta=f_hasta,
        ),
        financiero=financiero,
        operacional_en_vivo=panel_op,
        graficos=graficos,
    )

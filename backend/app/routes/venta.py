import uuid
from datetime import datetime, timezone, timedelta
from decimal import Decimal
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_, func, cast, String
from app.core.security import get_current_user
from app.database import get_db
from app.models.venta import Venta
from app.models.venta_operacion import VentaOperacion
from app.schemas.venta import (
    VentaResponse,
    VentaDirectaCreate,
    VentaCheckoutCreate,
    VentaCheckoutResponse,
    VentaOperacionResponse,
    VentaOperacionListItem,
    HistorialVentasKPIs,
    HistorialVentasResponse,
    MAPA_NORMALIZACION_METODOS,
)
from app.services.ventas import procesar_checkout


router = APIRouter()
ZONA_COLOMBIA = timezone(timedelta(hours=-5))



def aplicar_fallbacks_venta(venta: Venta) -> dict:
    cant = venta.cantidad if venta.cantidad is not None else 1
    subt = venta.subtotal if venta.subtotal is not None else (venta.precio_venta or 0.0)
    pu = venta.precio_unitario if venta.precio_unitario is not None else (venta.precio_venta or 0.0)
    
    costo_t = venta.costo_total if venta.costo_total is not None else 0.0
    util = venta.utilidad
    if util is None:
        if venta.encargo and hasattr(venta.encargo, 'utilidad_estimada') and venta.encargo.utilidad_estimada is not None:
            util = venta.encargo.utilidad_estimada
        else:
            util = subt - costo_t
            
    marca_val = venta.marca
    ref_val = venta.referencia
    if ref_val is None and venta.encargo:
        ref_val = venta.encargo.referencia
        
    return {
        "id": venta.id,
        "encargo_id": venta.encargo_id,
        "inventario_id": venta.inventario_id,
        "inventario_talla_id": venta.inventario_talla_id,
        "cliente_id": venta.cliente_id,
        "cliente_nombre": venta.cliente_nombre,
        "cliente_telefono": venta.cliente_telefono,
        "proveedor_id": venta.proveedor_id,
        "proveedor_nombre": venta.proveedor_nombre,
        "proveedor_telefono": venta.proveedor_telefono,
        "marca": marca_val,
        "referencia": ref_val,
        "talla_eur": venta.talla_eur,
        "talla_col": venta.talla_col,
        "foto": venta.foto,
        "cantidad": cant,
        "precio_unitario": pu,
        "subtotal": subt,
        "precio_venta": venta.precio_venta,
        "costo_base": venta.costo_base,
        "costo_envio": venta.costo_envio,
        "costo_despachador": venta.costo_despachador,
        "costo_total": costo_t,
        "utilidad": util,
        "metodo_pago": venta.metodo_pago,
        "fecha_venta": venta.fecha_venta,
        "origen": venta.origen,
        "observaciones": venta.observaciones,
        "fecha_registro": venta.fecha_registro
    }


@router.post("/ventas/directa", response_model=VentaResponse, status_code=201)
def registrar_venta_directa(
    data: VentaDirectaCreate,
    db: Session = Depends(get_db),
    current_user: str = Depends(get_current_user),
):
    if data.cantidad <= 0:
        raise HTTPException(status_code=400, detail="La cantidad debe ser mayor a 0")
    if data.precio_unitario <= 0:
        raise HTTPException(status_code=400, detail="El precio unitario debe ser mayor a 0")

    from app.schemas.venta import VentaCheckoutItem

    # Convertir VentaDirectaCreate a VentaCheckoutCreate con un solo item
    checkout_item = VentaCheckoutItem(
        inventario_talla_id=data.inventario_talla_id,
        cantidad=data.cantidad,
        precio_unitario=data.precio_unitario
    )
    checkout_data = VentaCheckoutCreate(
        items=[checkout_item],
        metodo_pago=data.metodo_pago,
        idempotency_key=f"directa-{uuid.uuid4().hex}",
        cliente_nombre=data.cliente_nombre,
        cliente_telefono=data.cliente_telefono,
        observaciones=data.observaciones
    )

    operacion = procesar_checkout(db, checkout_data, origen="inventario")
    
    if not operacion.detalles:
        raise HTTPException(status_code=500, detail="No se pudo registrar la línea de venta.")
        
    return aplicar_fallbacks_venta(operacion.detalles[0])


@router.get("/ventas", response_model=list[VentaResponse])
def listar_ventas(
    fecha_desde: str | None = Query(default=None),
    fecha_hasta: str | None = Query(default=None),
    origen: str | None = Query(default=None),
    metodo_pago: str | None = Query(default=None),
    telefono: str | None = Query(default=None),
    marca: str | None = Query(default=None),
    referencia: str | None = Query(default=None),
    talla_eur: str | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: str = Depends(get_current_user),
):
    query = db.query(Venta)

    if fecha_desde:
        query = query.filter(Venta.fecha_venta >= fecha_desde)
    if fecha_hasta:
        query = query.filter(Venta.fecha_venta <= fecha_hasta)
    if origen:
        query = query.filter(Venta.origen == origen)
    if metodo_pago:
        query = query.filter(Venta.metodo_pago == metodo_pago)
    if telefono:
        query = query.filter(Venta.cliente_telefono.ilike(f"%{telefono}%"))
    if marca:
        query = query.filter(Venta.marca.ilike(f"%{marca}%"))
    if referencia:
        from app.models.encargo import Encargo
        query = query.outerjoin(Encargo).filter(
            or_(
                Venta.referencia.ilike(f"%{referencia}%"),
                Encargo.referencia.ilike(f"%{referencia}%")
            )
        )
    if talla_eur:
        query = query.filter(Venta.talla_eur == talla_eur)

    ventas = query.order_by(Venta.fecha_venta.desc(), Venta.id.desc()).all()
    return [aplicar_fallbacks_venta(v) for v in ventas]


@router.get("/ventas/resumen")
def obtener_resumen_ventas(
    fecha_desde: str | None = Query(default=None),
    fecha_hasta: str | None = Query(default=None),
    origen: str | None = Query(default=None),
    metodo_pago: str | None = Query(default=None),
    telefono: str | None = Query(default=None),
    marca: str | None = Query(default=None),
    referencia: str | None = Query(default=None),
    talla_eur: str | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: str = Depends(get_current_user),
):
    query = db.query(Venta)

    if fecha_desde:
        query = query.filter(Venta.fecha_venta >= fecha_desde)
    if fecha_hasta:
        query = query.filter(Venta.fecha_venta <= fecha_hasta)
    if origen:
        query = query.filter(Venta.origen == origen)
    if metodo_pago:
        query = query.filter(Venta.metodo_pago == metodo_pago)
    if telefono:
        query = query.filter(Venta.cliente_telefono.ilike(f"%{telefono}%"))
    if marca:
        query = query.filter(Venta.marca.ilike(f"%{marca}%"))
    if referencia:
        from app.models.encargo import Encargo
        query = query.outerjoin(Encargo).filter(
            or_(
                Venta.referencia.ilike(f"%{referencia}%"),
                Encargo.referencia.ilike(f"%{referencia}%")
            )
        )
    if talla_eur:
        query = query.filter(Venta.talla_eur == talla_eur)

    ventas = query.all()

    total_ventas = len(ventas)
    unidades_vendidas = 0
    ingresos_totales = 0.0
    costos_totales = 0.0
    utilidad_total = 0.0
    
    ventas_por_metodo_pago = {}
    ventas_por_origen = {}

    for v in ventas:
        cant = v.cantidad if v.cantidad is not None else 1
        subt = v.subtotal if v.subtotal is not None else (v.precio_venta or 0.0)
        costo_t = v.costo_total if v.costo_total is not None else 0.0
        
        util = v.utilidad
        if util is None:
            if v.encargo and hasattr(v.encargo, 'utilidad_estimada') and v.encargo.utilidad_estimada is not None:
                util = v.encargo.utilidad_estimada
            else:
                util = subt - costo_t
                
        unidades_vendidas += cant
        ingresos_totales += subt
        costos_totales += costo_t
        utilidad_total += util

        mp = v.metodo_pago or "indefinido"
        ventas_por_metodo_pago[mp] = ventas_por_metodo_pago.get(mp, 0.0) + subt

        orig = v.origen or "indefinido"
        ventas_por_origen[orig] = ventas_por_origen.get(orig, 0.0) + subt

    ticket_promedio = ingresos_totales / total_ventas if total_ventas > 0 else 0.0

    return {
        "total_ventas": total_ventas,
        "unidades_vendidas": unidades_vendidas,
        "ingresos_totales": ingresos_totales,
        "costos_totales": costos_totales,
        "utilidad_total": utilidad_total,
        "ticket_promedio": ticket_promedio,
        "ventas_por_metodo_pago": ventas_por_metodo_pago,
        "ventas_por_origen": ventas_por_origen
    }


@router.post("/ventas/checkout", response_model=VentaCheckoutResponse, status_code=201)
def registrar_venta_checkout(
    data: VentaCheckoutCreate,
    db: Session = Depends(get_db),
    current_user: str = Depends(get_current_user),
):
    try:
        operacion = procesar_checkout(db, data, origen="inventario")
        return {
            "operacion": operacion,
            "detalles": [aplicar_fallbacks_venta(v) for v in operacion.detalles],
            "total_bruto": operacion.total_bruto,
            "costo_total": operacion.costo_total,
            "utilidad_total": operacion.utilidad_total,
            "cantidad_items": operacion.cantidad_items
        }
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/ventas/operaciones", response_model=HistorialVentasResponse)
def listar_operaciones(
    fecha_desde: Optional[str] = Query(default=None),
    fecha_hasta: Optional[str] = Query(default=None),
    metodo_pago: Optional[str] = Query(default=None),
    buscar: Optional[str] = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    current_user: str = Depends(get_current_user),
):
    fecha_desde = fecha_desde if isinstance(fecha_desde, str) else None
    fecha_hasta = fecha_hasta if isinstance(fecha_hasta, str) else None
    metodo_pago = metodo_pago if isinstance(metodo_pago, str) else None
    buscar = buscar if isinstance(buscar, str) else None
    limit = limit if isinstance(limit, int) else 50
    offset = offset if isinstance(offset, int) else 0

    # 1. Preparar filtros de fecha UTC para VentaOperacion
    dt_desde_utc = None
    dt_hasta_utc = None
    if fecha_desde and fecha_desde.strip():
        try:
            d_desde = datetime.strptime(fecha_desde.strip(), "%Y-%m-%d")
            # 00:00:00 en Colombia (UTC-5) equivale a 05:00:00 UTC
            dt_desde_utc = d_desde.replace(tzinfo=ZONA_COLOMBIA).astimezone(timezone.utc).replace(tzinfo=None)
        except ValueError:
            pass

    if fecha_hasta and fecha_hasta.strip():
        try:
            # Fin del día fecha_hasta
            d_hasta = datetime.strptime(fecha_hasta.strip(), "%Y-%m-%d") + timedelta(days=1)
            dt_hasta_utc = d_hasta.replace(tzinfo=ZONA_COLOMBIA).astimezone(timezone.utc).replace(tzinfo=None)
        except ValueError:
            pass

    # 2. Consultar VentaOperacion
    q_ops = db.query(VentaOperacion)
    if dt_desde_utc:
        q_ops = q_ops.filter(VentaOperacion.fecha_venta >= dt_desde_utc)
    if dt_hasta_utc:
        q_ops = q_ops.filter(VentaOperacion.fecha_venta < dt_hasta_utc)
    if metodo_pago and metodo_pago.strip():
        metodo_clean = metodo_pago.strip()
        q_ops = q_ops.filter(func.lower(VentaOperacion.metodo_pago) == metodo_clean.lower())
    if buscar and buscar.strip():
        b = buscar.strip()
        q_ops = q_ops.filter(
            or_(
                VentaOperacion.numero_venta.ilike(f"%{b}%"),
                VentaOperacion.cliente_nombre.ilike(f"%{b}%"),
                VentaOperacion.cliente_telefono.ilike(f"%{b}%"),
            )
        )
    operaciones = q_ops.all()

    # 3. Consultar Ventas Directas Legacy (origen = 'inventario' AND operacion_id IS NULL)
    q_legacy = db.query(Venta).filter(
        Venta.origen == "inventario",
        Venta.operacion_id.is_(None),
    )
    if fecha_desde and fecha_desde.strip():
        q_legacy = q_legacy.filter(Venta.fecha_venta >= fecha_desde.strip())
    if fecha_hasta and fecha_hasta.strip():
        q_legacy = q_legacy.filter(Venta.fecha_venta <= fecha_hasta.strip())
    if metodo_pago and metodo_pago.strip():
        metodo_clean = metodo_pago.strip()
        q_legacy = q_legacy.filter(func.lower(Venta.metodo_pago) == metodo_clean.lower())
    if buscar and buscar.strip():
        b = buscar.strip()
        id_search = b.upper().replace("V-DIR-", "")
        filtros_or = [
            Venta.cliente_nombre.ilike(f"%{b}%"),
            Venta.cliente_telefono.ilike(f"%{b}%"),
            Venta.referencia.ilike(f"%{b}%"),
        ]
        if id_search.isdigit():
            filtros_or.append(Venta.id == int(id_search))
        q_legacy = q_legacy.filter(or_(*filtros_or))
    legacy_ventas = q_legacy.all()

    # 4. Mapear a VentaOperacionListItem
    items_ops: list[VentaOperacionListItem] = []
    for op in operaciones:
        if op.fecha_venta:
            dt_utc = op.fecha_venta.replace(tzinfo=timezone.utc)
            dt_co = dt_utc.astimezone(ZONA_COLOMBIA)
            fecha_str = dt_co.isoformat()
        else:
            fecha_str = ""

        metodo_norm = MAPA_NORMALIZACION_METODOS.get((op.metodo_pago or "").lower(), op.metodo_pago or "Efectivo")

        items_ops.append(
            VentaOperacionListItem(
                id=op.id,
                numero_venta=op.numero_venta,
                cliente_nombre=op.cliente_nombre or "Cliente casual",
                cliente_telefono=op.cliente_telefono,
                metodo_pago=metodo_norm,
                total_bruto=op.total_bruto or Decimal("0.0"),
                costo_total=op.costo_total or Decimal("0.0"),
                utilidad_total=op.utilidad_total or Decimal("0.0"),
                cantidad_items=op.cantidad_items or 1,
                origen=op.origen or "inventario",
                observaciones=op.observaciones,
                fecha_venta=fecha_str,
                fecha_registro=op.fecha_registro.isoformat() if op.fecha_registro else None,
                es_legacy=False,
            )
        )

    items_legacy: list[VentaOperacionListItem] = []
    for v in legacy_ventas:
        metodo_norm = MAPA_NORMALIZACION_METODOS.get((v.metodo_pago or "").lower(), v.metodo_pago or "Efectivo")
        subt = Decimal(str(v.subtotal if v.subtotal is not None else (v.precio_venta or 0.0)))
        costo_t = Decimal(str(v.costo_total if v.costo_total is not None else 0.0))
        util = Decimal(str(v.utilidad if v.utilidad is not None else (float(subt) - float(costo_t))))

        items_legacy.append(
            VentaOperacionListItem(
                id=v.id,
                numero_venta=f"V-DIR-{v.id}",
                cliente_nombre=v.cliente_nombre or "Cliente casual",
                cliente_telefono=v.cliente_telefono,
                metodo_pago=metodo_norm,
                total_bruto=subt,
                costo_total=costo_t,
                utilidad_total=util,
                cantidad_items=v.cantidad or 1,
                origen="inventario",
                observaciones=v.observaciones,
                fecha_venta=v.fecha_venta or "",
                fecha_registro=v.fecha_registro.isoformat() if v.fecha_registro else None,
                es_legacy=True,
            )
        )

    # 5. Unificar y ordenar cronológicamente descendente
    merged = items_ops + items_legacy
    merged.sort(key=lambda x: (x.fecha_venta or "", x.id), reverse=True)

    # 6. Calcular KPIs globales sobre todo el conjunto filtrado
    total_transacciones = len(merged)
    unidades_vendidas = sum(item.cantidad_items for item in merged)
    total_cobrado = sum((item.total_bruto for item in merged), Decimal("0.0"))
    costos_directos = sum((item.costo_total for item in merged), Decimal("0.0"))
    utilidad_bruta = sum((item.utilidad_total for item in merged), Decimal("0.0"))

    # 7. Aplicar paginación
    paginated_items = merged[offset : offset + limit]

    return HistorialVentasResponse(
        items=paginated_items,
        total=total_transacciones,
        limit=limit,
        offset=offset,
        kpis=HistorialVentasKPIs(
            total_transacciones=total_transacciones,
            unidades_vendidas=unidades_vendidas,
            total_cobrado=total_cobrado,
            costos_directos=costos_directos,
            utilidad_bruta=utilidad_bruta,
        ),
    )


@router.get("/ventas/operaciones/{operacion_id}", response_model=VentaCheckoutResponse)
def obtener_operacion(
    operacion_id: int,
    es_legacy: bool = Query(default=False),
    db: Session = Depends(get_db),
    current_user: str = Depends(get_current_user),
):
    if es_legacy:
        v = db.query(Venta).filter(
            Venta.id == operacion_id,
            Venta.origen == "inventario",
            Venta.operacion_id.is_(None),
        ).first()
        if not v:
            raise HTTPException(status_code=404, detail="La venta directa no existe")

        metodo_norm = MAPA_NORMALIZACION_METODOS.get((v.metodo_pago or "").lower(), v.metodo_pago or "Efectivo")
        subt = Decimal(str(v.subtotal if v.subtotal is not None else (v.precio_venta or 0.0)))
        costo_t = Decimal(str(v.costo_total if v.costo_total is not None else 0.0))
        util = Decimal(str(v.utilidad if v.utilidad is not None else (float(subt) - float(costo_t))))

        operacion_virtual = VentaOperacionResponse(
            id=v.id,
            numero_venta=f"V-DIR-{v.id}",
            idempotency_key=None,
            cliente_id=v.cliente_id,
            cliente_nombre=v.cliente_nombre or "Cliente casual",
            cliente_telefono=v.cliente_telefono,
            metodo_pago=metodo_norm,
            total_bruto=subt,
            costo_total=costo_t,
            utilidad_total=util,
            cantidad_items=v.cantidad or 1,
            origen="inventario",
            observaciones=v.observaciones,
            fecha_venta=v.fecha_registro or datetime.utcnow(),
            fecha_registro=v.fecha_registro or datetime.utcnow(),
            es_legacy=True,
        )
        return {
            "operacion": operacion_virtual,
            "detalles": [aplicar_fallbacks_venta(v)],
            "total_bruto": subt,
            "costo_total": costo_t,
            "utilidad_total": util,
            "cantidad_items": v.cantidad or 1,
        }

    operacion = db.query(VentaOperacion).filter(VentaOperacion.id == operacion_id).first()
    if not operacion:
        raise HTTPException(status_code=404, detail="La operación de venta no existe")

    if operacion.metodo_pago:
        operacion.metodo_pago = MAPA_NORMALIZACION_METODOS.get(operacion.metodo_pago.lower(), operacion.metodo_pago)

    return {
        "operacion": operacion,
        "detalles": [aplicar_fallbacks_venta(v) for v in operacion.detalles],
        "total_bruto": operacion.total_bruto,
        "costo_total": operacion.costo_total,
        "utilidad_total": operacion.utilidad_total,
        "cantidad_items": operacion.cantidad_items,
    }


@router.get("/ventas/{venta_id}", response_model=VentaResponse)
def obtener_venta(
    venta_id: int,
    db: Session = Depends(get_db),
    current_user: str = Depends(get_current_user),
):
    venta = db.query(Venta).filter(Venta.id == venta_id).first()
    if not venta:
        raise HTTPException(status_code=404, detail="La venta no existe")
    return aplicar_fallbacks_venta(venta)

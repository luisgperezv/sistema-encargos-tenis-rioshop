from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_
from app.core.security import get_current_user
from app.database import get_db
from app.models.venta import Venta
from app.models.venta_operacion import VentaOperacion
from app.schemas.venta import VentaResponse, VentaDirectaCreate, VentaCheckoutCreate, VentaCheckoutResponse, VentaOperacionResponse
from app.services.ventas import procesar_checkout


router = APIRouter()


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


@router.get("/ventas/operaciones", response_model=list[VentaOperacionResponse])
def listar_operaciones(
    db: Session = Depends(get_db),
    current_user: str = Depends(get_current_user),
):
    operaciones = db.query(VentaOperacion).order_by(
        VentaOperacion.fecha_venta.desc(),
        VentaOperacion.id.desc()
    ).all()
    return operaciones


@router.get("/ventas/operaciones/{operacion_id}", response_model=VentaCheckoutResponse)
def obtener_operacion(
    operacion_id: int,
    db: Session = Depends(get_db),
    current_user: str = Depends(get_current_user),
):
    operacion = db.query(VentaOperacion).filter(VentaOperacion.id == operacion_id).first()
    if not operacion:
        raise HTTPException(status_code=404, detail="La operación de venta no existe")
    
    return {
        "operacion": operacion,
        "detalles": [aplicar_fallbacks_venta(v) for v in operacion.detalles],
        "total_bruto": operacion.total_bruto,
        "costo_total": operacion.costo_total,
        "utilidad_total": operacion.utilidad_total,
        "cantidad_items": operacion.cantidad_items
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

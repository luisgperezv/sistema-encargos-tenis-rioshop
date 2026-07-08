from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_
from app.core.security import get_current_user
from app.database import get_db
from app.models.venta import Venta
from app.schemas.venta import VentaResponse, VentaDirectaCreate


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

    from app.models.inventario_talla import InventarioTalla
    from app.models.inventario import Inventario
    from datetime import date

    # Locking de fila para evitar condiciones de carrera (concurrencia)
    talla_rel = db.query(InventarioTalla).filter(InventarioTalla.id == data.inventario_talla_id).with_for_update().first()
    if not talla_rel:
        raise HTTPException(status_code=404, detail="La talla especificada no existe en el inventario")

    if talla_rel.cantidad < data.cantidad:
        raise HTTPException(
            status_code=400,
            detail=f"Stock insuficiente. Disponible: {talla_rel.cantidad}, Solicitado: {data.cantidad}"
        )

    producto = db.query(Inventario).filter(Inventario.id == talla_rel.inventario_id).first()
    if not producto:
        raise HTTPException(status_code=404, detail="El producto de inventario no existe")

    # Restar stock
    talla_rel.cantidad -= data.cantidad

    # Actualizar estado de inventario si no queda stock
    stock_restante = sum(t.cantidad for t in producto.tallas)
    if stock_restante <= 0:
        producto.estado = "agotado"

    # Calcular importes
    subtotal = data.precio_unitario * data.cantidad
    costo_total = (producto.costo or 0.0) * data.cantidad
    utilidad = subtotal - costo_total

    cliente_nombre = data.cliente_nombre.strip() if data.cliente_nombre and data.cliente_nombre.strip() else "Cliente casual"
    cliente_telefono = data.cliente_telefono.strip() if data.cliente_telefono and data.cliente_telefono.strip() else None

    nueva_venta = Venta(
        inventario_id=producto.id,
        inventario_talla_id=talla_rel.id,
        cliente_nombre=cliente_nombre,
        cliente_telefono=cliente_telefono,
        marca=producto.marca,
        referencia=producto.referencia,
        talla_eur=talla_rel.talla_eur,
        talla_col=talla_rel.talla_col,
        foto=producto.foto,
        cantidad=data.cantidad,
        precio_unitario=data.precio_unitario,
        subtotal=subtotal,
        precio_venta=subtotal,
        costo_base=producto.costo or 0.0,
        costo_envio=0.0,
        costo_despachador=0.0,
        costo_total=costo_total,
        utilidad=utilidad,
        metodo_pago=data.metodo_pago,
        fecha_venta=str(date.today()),
        origen="inventario",
        observaciones=data.observaciones
    )

    db.add(nueva_venta)
    try:
        db.commit()
        db.refresh(nueva_venta)
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error al registrar la venta: {str(e)}")

    # Retornar con fallbacks aplicados
    return aplicar_fallbacks_venta(nueva_venta)


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

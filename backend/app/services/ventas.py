from sqlalchemy.orm import Session
from fastapi import HTTPException
from app.models.encargo import Encargo
from app.models.venta import Venta
from app.models.cliente import Cliente
from app.models.proveedor import Proveedor
from datetime import date


def crear_venta_desde_encargo_si_no_existe(db: Session, encargo: Encargo) -> Venta | None:
    # 1. Comprobar si ya existe una venta para este encargo_id (Idempotencia)
    venta_existente = db.query(Venta).filter(Venta.encargo_id == encargo.id).first()
    if venta_existente:
        print(f"[VENTAS] Venta ya existe para encargo_id {encargo.id}. Retornando existente.")
        return venta_existente

    # 2. Validaciones obligatorias de estado y negocio
    if encargo.estado != "entregado":
        raise HTTPException(
            status_code=400,
            detail=f"No se puede generar venta para un encargo en estado '{encargo.estado}'"
        )
    
    if encargo.saldo > 0:
        raise HTTPException(
            status_code=400,
            detail="No se puede generar venta si existe saldo pendiente."
        )

    if encargo.costo_total is None or encargo.costo_total <= 0:
        raise HTTPException(
            status_code=400,
            detail="No se puede generar venta para un encargo sin costos registrados."
        )

    if not encargo.metodo_pago or not encargo.metodo_pago.strip():
        raise HTTPException(
            status_code=400,
            detail="No se puede generar venta sin un método de pago definido."
        )

    # 3. Obtener snapshots de Cliente y Proveedor
    cliente = encargo.cliente
    if not cliente:
        cliente = db.query(Cliente).filter(Cliente.id == encargo.cliente_id).first()
    if not cliente:
        raise HTTPException(
            status_code=404,
            detail="Cliente asociado al encargo no encontrado."
        )

    proveedor_id = encargo.proveedor_id
    proveedor_nombre = None
    proveedor_telefono = None
    if proveedor_id:
        proveedor = encargo.proveedor
        if not proveedor:
            proveedor = db.query(Proveedor).filter(Proveedor.id == proveedor_id).first()
        if proveedor:
            proveedor_nombre = proveedor.nombre
            proveedor_telefono = proveedor.telefono

    # 4. Calcular utilidad
    utilidad = encargo.utilidad_estimada
    if utilidad is None:
        utilidad = encargo.precio - encargo.costo_total

    # 5. Construir y agregar Venta
    nueva_venta = Venta(
        encargo_id=encargo.id,
        cliente_id=cliente.id,
        cliente_nombre=cliente.nombre,
        cliente_telefono=cliente.telefono,
        proveedor_id=proveedor_id,
        proveedor_nombre=proveedor_nombre,
        proveedor_telefono=proveedor_telefono,
        referencia=encargo.referencia,
        talla_eur=encargo.talla_eur,
        talla_col=encargo.talla_col,
        foto=encargo.foto,
        precio_venta=encargo.precio,
        costo_base=encargo.costo_base or 0.0,
        costo_envio=encargo.costo_envio or 0.0,
        costo_despachador=encargo.costo_despachador or 0.0,
        costo_total=encargo.costo_total,
        utilidad=utilidad,
        metodo_pago=encargo.metodo_pago,
        fecha_venta=encargo.fecha_entregado or str(date.today()),
        origen="encargo",
        cantidad=1,
        precio_unitario=encargo.precio,
        subtotal=encargo.precio
    )

    db.add(nueva_venta)
    db.flush()
    print(f"[VENTAS] Venta registrada exitosamente para encargo_id {encargo.id}")
    return nueva_venta

from sqlalchemy.orm import Session
from fastapi import HTTPException
from app.models.encargo import Encargo
from app.models.venta import Venta
from app.models.cliente import Cliente
from app.models.proveedor import Proveedor
from datetime import date, datetime
from decimal import Decimal
import uuid
from sqlalchemy.exc import IntegrityError
from app.models.venta_operacion import VentaOperacion
from app.models.inventario_talla import InventarioTalla
from app.models.inventario import Inventario
from app.schemas.venta import VentaCheckoutCreate


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


def generar_numero_venta() -> str:
    return f"V-{datetime.utcnow().strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"


def procesar_checkout(db: Session, data: VentaCheckoutCreate, origen: str = "inventario") -> VentaOperacion:
    # 1. Validar que no vengan talla_ids duplicados
    talla_ids = [item.inventario_talla_id for item in data.items]
    if len(talla_ids) != len(set(talla_ids)):
        raise HTTPException(
            status_code=400,
            detail="No se permiten IDs de talla duplicados dentro del mismo checkout."
        )

    # 2. Generar VentaOperacion de forma segura ante colisiones de clave única
    intentos = 3
    operacion = None
    
    for int_num in range(intentos):
        numero_venta = generar_numero_venta()
        
        # Verificar si ya existe en la DB antes de intentar insertar
        existente = db.query(VentaOperacion).filter(VentaOperacion.numero_venta == numero_venta).first()
        if existente:
            continue
            
        operacion = VentaOperacion(
            numero_venta=numero_venta,
            cliente_id=data.cliente_id,
            cliente_nombre=data.cliente_nombre.strip() if data.cliente_nombre and data.cliente_nombre.strip() else "Cliente casual",
            cliente_telefono=data.cliente_telefono.strip() if data.cliente_telefono and data.cliente_telefono.strip() else None,
            metodo_pago=data.metodo_pago,
            total_bruto=Decimal("0.0"),
            costo_total=Decimal("0.0"),
            utilidad_total=Decimal("0.0"),
            cantidad_items=0,
            origen=origen,
            observaciones=data.observaciones,
            fecha_venta=datetime.utcnow(),
            fecha_registro=datetime.utcnow()
        )
        db.add(operacion)
        try:
            db.flush() # flush para obtener operacion.id y comprobar UNIQUE
            break
        except IntegrityError:
            db.rollback()
            operacion = None
            if int_num == intentos - 1:
                raise HTTPException(
                    status_code=500,
                    detail="No se pudo generar un número de venta único después de varios intentos."
                )
    
    if not operacion:
        raise HTTPException(
            status_code=500,
            detail="Error al inicializar la operación de venta."
        )

    try:
        total_bruto = Decimal("0.0")
        costo_total_operacion = Decimal("0.0")
        utilidad_total_operacion = Decimal("0.0")
        cantidad_items_operacion = 0
        
        modified_productos = {}

        # Bucle de procesamiento de cada item
        for item in data.items:
            # Lock de fila en base de datos para evitar carreras concurrentes
            talla_rel = db.query(InventarioTalla).filter(
                InventarioTalla.id == item.inventario_talla_id
            ).with_for_update().first()
            
            if not talla_rel:
                raise HTTPException(
                    status_code=404,
                    detail=f"La talla con ID {item.inventario_talla_id} no existe en el inventario."
                )
                
            if talla_rel.cantidad < item.cantidad:
                raise HTTPException(
                    status_code=400,
                    detail=f"Stock insuficiente para la talla {talla_rel.talla_eur}. Disponible: {talla_rel.cantidad}, Solicitado: {item.cantidad}"
                )
                
            producto = db.query(Inventario).filter(Inventario.id == talla_rel.inventario_id).first()
            if not producto:
                raise HTTPException(
                    status_code=404,
                    detail=f"El producto de inventario asociado a la talla {talla_rel.id} no existe."
                )

            # Descontar stock
            talla_rel.cantidad -= item.cantidad
            modified_productos[producto.id] = producto

            # Cálculos financieros usando Decimal
            precio_unitario_dec = Decimal(str(item.precio_unitario))
            cantidad_dec = Decimal(str(item.cantidad))
            costo_base_dec = Decimal(str(producto.costo or 0.0))
            
            subtotal_dec = precio_unitario_dec * cantidad_dec
            costo_linea_dec = costo_base_dec * cantidad_dec
            utilidad_linea_dec = subtotal_dec - costo_linea_dec
            
            # Acumular para la cabecera
            total_bruto += subtotal_dec
            costo_total_operacion += costo_linea_dec
            utilidad_total_operacion += utilidad_linea_dec
            cantidad_items_operacion += item.cantidad

            # Crear la línea en ventas vinculada con operacion_id
            nueva_venta = Venta(
                operacion_id=operacion.id,
                inventario_id=producto.id,
                inventario_talla_id=talla_rel.id,
                cliente_id=data.cliente_id,
                cliente_nombre=operacion.cliente_nombre,
                cliente_telefono=operacion.cliente_telefono,
                marca=producto.marca,
                referencia=producto.referencia,
                talla_eur=talla_rel.talla_eur,
                talla_col=talla_rel.talla_col,
                foto=producto.foto,
                cantidad=item.cantidad,
                precio_unitario=float(precio_unitario_dec),
                subtotal=float(subtotal_dec),
                precio_venta=float(subtotal_dec),
                costo_base=float(costo_base_dec),
                costo_envio=0.0,
                costo_despachador=0.0,
                costo_total=float(costo_linea_dec),
                utilidad=float(utilidad_linea_dec),
                metodo_pago=data.metodo_pago,
                fecha_venta=str(date.today()),
                origen=origen,
                observaciones=data.observaciones
            )
            db.add(nueva_venta)

        # Actualizar cabecera con totales calculados
        operacion.total_bruto = total_bruto
        operacion.costo_total = costo_total_operacion
        operacion.utilidad_total = utilidad_total_operacion
        operacion.cantidad_items = cantidad_items_operacion
        
        # Actualizar estado de inventario si no queda stock total
        for prod_id, prod in modified_productos.items():
            total_stock = sum(t.cantidad for t in prod.tallas)
            if total_stock <= 0:
                prod.estado = "agotado"
                
        db.flush()
        db.commit()
        db.refresh(operacion)
        return operacion

    except Exception as e:
        db.rollback()
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(
            status_code=500,
            detail=f"Error al procesar el checkout de la venta: {str(e)}"
        )

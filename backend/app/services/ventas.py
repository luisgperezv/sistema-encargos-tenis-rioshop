from sqlalchemy.orm import Session
from fastapi import HTTPException
from app.models.encargo import Encargo
from app.models.venta import Venta
from app.models.cliente import Cliente
from app.models.proveedor import Proveedor
from datetime import date, datetime, timezone, timedelta
from decimal import Decimal
import uuid
from sqlalchemy.exc import IntegrityError
from app.models.venta_operacion import VentaOperacion
from app.models.inventario_talla import InventarioTalla
from app.models.inventario import Inventario
from app.models.inventario_talla_lote import InventarioTallaLote
from app.models.venta_lote_consumo import VentaLoteConsumo
from app.schemas.venta import VentaCheckoutCreate

ZONA_COLOMBIA = timezone(timedelta(hours=-5))



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
    # 0. Idempotencia persistente en backend: si ya existe una operación con este idempotency_key, retornarla
    if data.idempotency_key:
        op_existente = db.query(VentaOperacion).filter(
            VentaOperacion.idempotency_key == data.idempotency_key
        ).first()
        if op_existente:
            return op_existente

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
            idempotency_key=data.idempotency_key,
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
            # En caso de colisión concurrente sobre idempotency_key
            if data.idempotency_key:
                op_concurrente = db.query(VentaOperacion).filter(
                    VentaOperacion.idempotency_key == data.idempotency_key
                ).first()
                if op_concurrente:
                    return op_concurrente
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

            # 1. Consultar y bloquear los lotes con stock disponible en orden FIFO determinístico (fecha_ingreso ASC, id ASC)
            lotes_disponibles = db.query(InventarioTallaLote).filter(
                InventarioTallaLote.inventario_talla_id == talla_rel.id,
                InventarioTallaLote.cantidad_disponible > 0
            ).order_by(
                InventarioTallaLote.fecha_ingreso.asc(),
                InventarioTallaLote.id.asc()
            ).with_for_update().all()

            # Fallback defensivo si la talla tiene stock pero no tenía lotes registrados
            if not lotes_disponibles and talla_rel.cantidad >= item.cantidad:
                costo_def = Decimal(str(producto.costo or 0.0))
                fecha_def = producto.fecha_ingreso or datetime.now(ZONA_COLOMBIA).strftime("%Y-%m-%d")
                lote_def = InventarioTallaLote(
                    inventario_talla_id=talla_rel.id,
                    costo_unitario=costo_def,
                    cantidad_inicial=talla_rel.cantidad,
                    cantidad_disponible=talla_rel.cantidad,
                    fecha_ingreso=fecha_def,
                    observaciones="Lote generado automáticamente por stock existente",
                    fecha_registro=datetime.utcnow()
                )
                db.add(lote_def)
                db.flush()
                lotes_disponibles = [lote_def]

            # 2. Descontar stock vía FIFO determinístico
            cant_por_descontar = item.cantidad
            consumos_lote = []
            costo_linea_dec = Decimal("0.0")

            for lote in lotes_disponibles:
                if cant_por_descontar <= 0:
                    break
                consumo = min(lote.cantidad_disponible, cant_por_descontar)
                lote.cantidad_disponible -= consumo
                cant_por_descontar -= consumo

                costo_u_dec = Decimal(str(lote.costo_unitario or 0.0))
                costo_tramo_dec = costo_u_dec * Decimal(str(consumo))
                costo_linea_dec += costo_tramo_dec

                consumos_lote.append({
                    "lote_id": lote.id,
                    "cantidad": consumo,
                    "costo_unitario": costo_u_dec,
                    "costo_total": costo_tramo_dec
                })

            if cant_por_descontar > 0:
                raise HTTPException(
                    status_code=400,
                    detail=f"Inconsistencia en capas de stock para la talla {talla_rel.talla_eur}. Lotes disponibles insuficientes."
                )

            # 3. Descontar stock visible de la talla (Invariancia: InventarioTalla.cantidad == sum(lotes.cantidad_disponible))
            talla_rel.cantidad -= item.cantidad
            modified_productos[producto.id] = producto

            # 4. Cálculos financieros usando Decimal
            precio_unitario_dec = Decimal(str(item.precio_unitario))
            cantidad_dec = Decimal(str(item.cantidad))
            subtotal_dec = precio_unitario_dec * cantidad_dec
            utilidad_linea_dec = subtotal_dec - costo_linea_dec
            costo_base_promedio_dec = costo_linea_dec / cantidad_dec

            # 5. Acumular para la cabecera
            total_bruto += subtotal_dec
            costo_total_operacion += costo_linea_dec
            utilidad_total_operacion += utilidad_linea_dec
            cantidad_items_operacion += item.cantidad

            # 6. Crear la línea en ventas vinculada con operacion_id
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
                costo_base=float(costo_base_promedio_dec),
                costo_envio=0.0,
                costo_despachador=0.0,
                costo_total=float(costo_linea_dec),
                utilidad=float(utilidad_linea_dec),
                metodo_pago=data.metodo_pago,
                fecha_venta=datetime.now(ZONA_COLOMBIA).strftime("%Y-%m-%d"),
                origen=origen,
                observaciones=data.observaciones
            )
            db.add(nueva_venta)
            db.flush()

            # 7. Registrar trazabilidad de consumos en venta_lote_consumos
            for c in consumos_lote:
                consumo_db = VentaLoteConsumo(
                    venta_id=nueva_venta.id,
                    lote_id=c["lote_id"],
                    cantidad=c["cantidad"],
                    costo_unitario=c["costo_unitario"],
                    costo_total=c["costo_total"],
                    fecha_registro=datetime.utcnow()
                )
                db.add(consumo_db)


        # Actualizar cabecera con totales calculados
        operacion.total_bruto = total_bruto
        operacion.costo_total = costo_total_operacion
        operacion.utilidad_total = utilidad_total_operacion
        operacion.cantidad_items = cantidad_items_operacion
        
        # Actualizar stock total y estado de inventario si no queda stock
        for prod_id, prod in modified_productos.items():
            total_stock = sum(t.cantidad for t in prod.tallas)
            prod.cantidad = total_stock
            if total_stock <= 0:
                prod.estado = "agotado"
                
        db.flush()
        db.commit()
        db.refresh(operacion)
        return operacion

    except Exception as e:
        db.rollback()
        # En caso de colisión concurrente sobre idempotency_key en commit
        if isinstance(e, IntegrityError) and data.idempotency_key:
            op_concurrente = db.query(VentaOperacion).filter(
                VentaOperacion.idempotency_key == data.idempotency_key
            ).first()
            if op_concurrente:
                return op_concurrente
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(
            status_code=500,
            detail=f"Error al procesar el checkout de la venta: {str(e)}"
        )


def anular_operacion_pos(
    db: Session,
    operacion_id: int,
    motivo: str,
    usuario: str | None = None
) -> tuple[VentaOperacion, int]:
    """
    Anula completamente una operación de venta POS moderna de forma transaccional y segura (ACID):
    - Valida motivo obligatorio.
    - Bloquea pesimistamente la operación y valida que esté 'completada'.
    - Verifica que todas las líneas tengan trazabilidad de lotes (venta_lote_consumos).
    - Restaura exactamente cada consumo al InventarioTallaLote de donde provino.
    - Restaura InventarioTalla.cantidad y valida la invarianza matemática.
    - Reactiva productos de 'agotado' a 'disponible' si recuperan stock.
    - Conserva intactos todos los snapshots financieros originales como evidencia histórica.
    - Marca VentaOperacion y Ventas como 'anulada' con fecha y motivo.
    """
    motivo_limpio = (motivo or "").strip()
    if len(motivo_limpio) < 5:
        raise HTTPException(
            status_code=400,
            detail="El motivo de anulación es obligatorio y debe contener al menos 5 caracteres."
        )

    try:
        # 1. Bloquear pesimistamente la operación para evitar carreras concurrentes
        operacion = db.query(VentaOperacion).filter(
            VentaOperacion.id == operacion_id
        ).with_for_update().first()

        if not operacion:
            raise HTTPException(
                status_code=404,
                detail=f"La operación de venta con ID {operacion_id} no existe."
            )

        # 2. Validar estado actual
        if operacion.estado == "anulada":
            dt_str = operacion.fecha_anulacion.strftime("%Y-%m-%d %H:%M:%S") if operacion.fecha_anulacion else "fecha no registrada"
            raise HTTPException(
                status_code=400,
                detail=f"La operación {operacion.numero_venta} ya fue anulada previamente ({dt_str})."
            )

        if operacion.estado != "completada":
            raise HTTPException(
                status_code=400,
                detail=f"La operación {operacion.numero_venta} se encuentra en estado '{operacion.estado}' y no puede ser anulada."
            )

        if operacion.origen not in ("inventario", "pos"):
            raise HTTPException(
                status_code=400,
                detail=f"Solo se pueden anular operaciones de venta POS/inventario. Origen actual: '{operacion.origen}'."
            )

        # 3. Bloquear pesimistamente las líneas en ventas
        lineas = db.query(Venta).filter(
            Venta.operacion_id == operacion.id
        ).order_by(Venta.id.asc()).with_for_update().all()

        if not lineas:
            raise HTTPException(
                status_code=400,
                detail=f"La operación {operacion.numero_venta} no tiene líneas de detalle registradas."
            )

        # 4. Validar trazabilidad estricta: todas las líneas deben tener venta_lote_consumos
        for linea in lineas:
            if not linea.lote_consumos or len(linea.lote_consumos) == 0:
                raise HTTPException(
                    status_code=400,
                    detail=f"La línea de venta #{linea.id} ({linea.marca} - {linea.referencia}) no cuenta con trazabilidad de lotes (venta_lote_consumos). No es posible realizar la anulación automática."
                )

        # 5. Bloquear en orden determinístico de IDs para prevenir deadlocks
        lot_ids = sorted(list({c.lote_id for linea in lineas for c in linea.lote_consumos}))
        for lid in lot_ids:
            db.query(InventarioTallaLote).filter(InventarioTallaLote.id == lid).with_for_update().first()

        talla_ids = sorted(list({linea.inventario_talla_id for linea in lineas if linea.inventario_talla_id}))
        for tid in talla_ids:
            db.query(InventarioTalla).filter(InventarioTalla.id == tid).with_for_update().first()

        # 6. Restauración exacta a lotes y tallas
        total_pares_restaurados = 0
        tallas_modificadas = {}
        productos_modificados = {}
        ahora_utc = datetime.utcnow()

        for linea in lineas:
            for consumo in linea.lote_consumos:
                lote = db.query(InventarioTallaLote).filter(InventarioTallaLote.id == consumo.lote_id).first()
                if not lote:
                    raise HTTPException(
                        status_code=500,
                        detail=f"El lote de inventario ID {consumo.lote_id} ya no existe en el sistema."
                    )

                # Restaurar cantidad disponible al lote original
                lote.cantidad_disponible += consumo.cantidad

                # Protección contra desbordamiento de capacidad
                if lote.cantidad_disponible > lote.cantidad_inicial:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Inconsistencia en lote {lote.id}: la cantidad disponible ({lote.cantidad_disponible}) superaría la cantidad inicial ({lote.cantidad_inicial})."
                    )
                total_pares_restaurados += consumo.cantidad

            # Restaurar cantidad visible de la talla
            if linea.inventario_talla_id:
                talla = db.query(InventarioTalla).filter(InventarioTalla.id == linea.inventario_talla_id).first()
                if talla:
                    talla.cantidad += (linea.cantidad or 1)
                    tallas_modificadas[talla.id] = talla

                    if talla.inventario_id and talla.inventario_id not in productos_modificados:
                        prod = db.query(Inventario).filter(Inventario.id == talla.inventario_id).with_for_update().first()
                        if prod:
                            productos_modificados[prod.id] = prod

            # Marcar línea como anulada conservando intactos los valores financieros (Evidencia histórica)
            linea.estado = "anulada"
            linea.fecha_anulacion = ahora_utc
            linea.motivo_anulacion = motivo_limpio

        # Flush para asentar los cambios de stock en la transacción antes de verificar
        db.flush()

        # 7. Verificar invarianza en cada talla modificada
        for tid, t in tallas_modificadas.items():
            db.refresh(t)
            sum_lotes = sum(l.cantidad_disponible for l in t.lotes)
            if t.cantidad != sum_lotes:
                raise HTTPException(
                    status_code=400,
                    detail=f"Invarianza violada en talla {t.id} ({t.talla_eur}): cantidad={t.cantidad} != lotes={sum_lotes} tras anulación."
                )

        # 8. Reactivar producto si estaba agotado y sincronizar stock total
        for pid, prod in productos_modificados.items():
            db.refresh(prod)
            total_stock = sum(t.cantidad for t in prod.tallas)
            prod.cantidad = total_stock
            if total_stock > 0 and prod.estado == "agotado":
                prod.estado = "disponible"

        # 9. Actualizar cabecera de la operación (Conserva snapshots financieros originales)
        operacion.estado = "anulada"
        operacion.fecha_anulacion = ahora_utc
        operacion.motivo_anulacion = motivo_limpio
        operacion.usuario_anulacion = usuario

        db.flush()
        db.commit()
        db.refresh(operacion)
        return operacion, total_pares_restaurados

    except Exception as e:
        db.rollback()
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(
            status_code=500,
            detail=f"Error inesperado al anular la operación de venta: {str(e)}"
        )

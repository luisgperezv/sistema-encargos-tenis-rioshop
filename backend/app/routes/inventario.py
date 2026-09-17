from datetime import datetime
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, selectinload
from sqlalchemy import or_, func
from app.core.security import get_current_user
from app.database import get_db
from app.models.inventario import Inventario
from app.models.inventario_talla import InventarioTalla
from app.models.inventario_talla_lote import InventarioTallaLote
from app.models.venta_lote_consumo import VentaLoteConsumo
from app.models.venta import Venta
from app.services.utils import normalizar_texto
from app.schemas.inventario import (
    InventarioCreate,
    InventarioUpdate,
    InventarioResponse,
    EntradaStockCreate,
    EntradaStockResponse,
    InventarioMovimientosResponse,
    ProductoMovimientosHeader,
    ResumenTallaMovimiento,
    CapaActivaItem,
    LoteMovimientoItem,
    ConsumoSalidaItem,
    MAPPING_TALLAS,
)

router = APIRouter()



def actualizar_estado_y_campos_compatibilidad(
    item: Inventario, estado_solicitado: str | None = None
):
    """
    Calcula el estado general del producto y actualiza los campos antiguos
    (talla_eur, talla_col, cantidad) para mantener compatibilidad en producción.
    """
    if item.tallas:
        todas_cero = all(t.cantidad == 0 for t in item.tallas)
        if todas_cero:
            item.estado = "agotado"
        else:
            # Si el usuario solicitó un estado explícito, lo usamos.
            # De lo contrario, si el producto ya está en reservado, lo respetamos.
            # En cualquier otro caso, vuelve a disponible.
            estado_final = estado_solicitado or item.estado
            if estado_final == "reservado":
                item.estado = "reservado"
            else:
                item.estado = "disponible"

        # Sincronizar campos antiguos con la primera talla de la lista para compatibilidad
        item.talla_eur = item.tallas[0].talla_eur
        item.talla_col = item.tallas[0].talla_col
        item.cantidad = sum(t.cantidad for t in item.tallas)
    else:
        # Fallback si no tiene tallas
        if item.cantidad == 0:
            item.estado = "agotado"
        elif estado_solicitado and estado_solicitado in ["disponible", "reservado"]:
            item.estado = estado_solicitado
        elif item.estado != "reservado":
            item.estado = "disponible"


@router.get("/inventario", response_model=list[InventarioResponse])
def listar_inventario(
    buscar: str | None = Query(default=None),
    marca: str | None = Query(default=None),
    estado: str | None = Query(default=None),
    talla_eur: str | None = Query(default=None),
    talla_col: str | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: str = Depends(get_current_user),
):
    query = db.query(Inventario)

    if buscar:
        buscar_term = f"%{buscar}%"
        query = query.filter(
            or_(
                Inventario.referencia.ilike(buscar_term),
                Inventario.marca.ilike(buscar_term),
                Inventario.observaciones.ilike(buscar_term),
            )
        )

    if marca:
        query = query.filter(Inventario.marca.ilike(marca))

    if estado:
        query = query.filter(Inventario.estado == estado)

    # Filtrar buscando dentro de la tabla inventario_tallas
    if talla_eur or talla_col:
        query = query.join(Inventario.tallas)
        if talla_eur:
            query = query.filter(InventarioTalla.talla_eur == talla_eur)
        if talla_col:
            query = query.filter(InventarioTalla.talla_col == talla_col)
        query = query.distinct()

    items = query.order_by(
        Inventario.marca_normalizada.asc(),
        Inventario.referencia_normalizada.asc(),
        Inventario.id.desc()
    ).all()
    return items


@router.get("/inventario/sugerencias/marcas", response_model=list[str])
def sugerencias_marcas(
    q: str = Query(""),
    db: Session = Depends(get_db),
    current_user: str = Depends(get_current_user),
):
    q_normalizado = normalizar_texto(q)
    query = db.query(func.min(Inventario.marca)).filter(
        Inventario.marca_normalizada != None,
        Inventario.marca_normalizada != ""
    )
    if q_normalizado:
        query = query.filter(Inventario.marca_normalizada.ilike(f"%{q_normalizado}%"))
    
    results = query.group_by(Inventario.marca_normalizada).limit(20).all()
    return [r[0] for r in results if r[0]]


@router.get("/inventario/sugerencias/referencias", response_model=list[str])
def sugerencias_referencias(
    q: str = Query(""),
    marca: str = Query(""),
    db: Session = Depends(get_db),
    current_user: str = Depends(get_current_user),
):
    query = db.query(func.min(Inventario.referencia)).filter(
        Inventario.referencia_normalizada != None,
        Inventario.referencia_normalizada != ""
    )
    if marca:
        marca_norm = normalizar_texto(marca)
        query = query.filter(Inventario.marca_normalizada == marca_norm)
    if q:
        q_normalizado = normalizar_texto(q)
        query = query.filter(Inventario.referencia_normalizada.ilike(f"%{q_normalizado}%"))
    
    results = query.group_by(Inventario.referencia_normalizada).limit(20).all()
    return [r[0] for r in results if r[0]]


@router.get("/inventario/{inventario_id}", response_model=InventarioResponse)
def obtener_item_inventario(
    inventario_id: int,
    db: Session = Depends(get_db),
    current_user: str = Depends(get_current_user),
):
    item = db.query(Inventario).filter(Inventario.id == inventario_id).first()
    if not item:
        raise HTTPException(
            status_code=404, detail="El artículo de inventario no existe"
        )
    return item


@router.post("/inventario", response_model=InventarioResponse)
def crear_item_inventario(
    data: InventarioCreate,
    db: Session = Depends(get_db),
    current_user: str = Depends(get_current_user),
):
    m_norm = normalizar_texto(data.marca)
    r_norm = normalizar_texto(data.referencia)

    existente = db.query(Inventario).filter(
        Inventario.marca_normalizada == m_norm,
        Inventario.referencia_normalizada == r_norm
    ).first()
    if existente:
        raise HTTPException(
            status_code=400,
            detail="Ya existe un producto registrado con esta combinación de Marca y Referencia."
        )

    nuevo_item = Inventario(
        marca=data.marca,
        marca_normalizada=m_norm,
        referencia=data.referencia,
        referencia_normalizada=r_norm,
        foto=data.foto,
        costo=data.costo,
        precio_sugerido=data.precio_sugerido,
        estado=data.estado,
        fecha_ingreso=data.fecha_ingreso,
        observaciones=data.observaciones,
    )

    # Crear las tallas correspondientes
    tallas_db = []
    for t in data.tallas:
        t_col = MAPPING_TALLAS.get(t.talla_eur, "38")
        t_db = InventarioTalla(
            talla_eur=t.talla_eur,
            talla_col=t_col,
            cantidad=t.cantidad,
        )
        tallas_db.append(t_db)

    nuevo_item.tallas = tallas_db

    # Calcular estados y rellenar columnas heredadas
    actualizar_estado_y_campos_compatibilidad(nuevo_item, data.estado)

    db.add(nuevo_item)
    db.flush()

    # Crear lotes iniciales para las tallas con stock > 0
    for t_db in nuevo_item.tallas:
        if t_db.cantidad > 0:
            lote = InventarioTallaLote(
                inventario_talla_id=t_db.id,
                costo_unitario=Decimal(str(nuevo_item.costo or 0.0)),
                cantidad_inicial=t_db.cantidad,
                cantidad_disponible=t_db.cantidad,
                fecha_ingreso=nuevo_item.fecha_ingreso,
                observaciones="Stock inicial del producto",
                fecha_registro=datetime.utcnow(),
            )
            db.add(lote)

    db.commit()
    db.refresh(nuevo_item)
    return nuevo_item


@router.put("/inventario/{inventario_id}", response_model=InventarioResponse)
def actualizar_item_inventario(
    inventario_id: int,
    data: InventarioUpdate,
    db: Session = Depends(get_db),
    current_user: str = Depends(get_current_user),
):
    item = db.query(Inventario).filter(Inventario.id == inventario_id).first()
    if not item:
        raise HTTPException(
            status_code=404, detail="El artículo de inventario no existe"
        )

    # Validar duplicados excluyendo el producto actual
    marca_def = data.marca if data.marca is not None else item.marca
    referencia_def = data.referencia if data.referencia is not None else item.referencia
    m_norm = normalizar_texto(marca_def)
    r_norm = normalizar_texto(referencia_def)

    existente = db.query(Inventario).filter(
        Inventario.marca_normalizada == m_norm,
        Inventario.referencia_normalizada == r_norm,
        Inventario.id != inventario_id,
    ).first()
    if existente:
        raise HTTPException(
            status_code=400,
            detail="Ya existe otro producto registrado con esta combinación de Marca y Referencia.",
        )

    # Actualizar campos recibidos
    if data.marca is not None:
        item.marca = data.marca
    item.marca_normalizada = m_norm

    if data.referencia is not None:
        item.referencia = data.referencia
    item.referencia_normalizada = r_norm

    if data.foto is not None:
        item.foto = data.foto
    if data.costo is not None:
        item.costo = data.costo
    if data.precio_sugerido is not None:
        item.precio_sugerido = data.precio_sugerido
    if data.fecha_ingreso is not None:
        item.fecha_ingreso = data.fecha_ingreso
    if data.observaciones is not None:
        item.observaciones = data.observaciones

    # Sincronización NO DESTRUCTIVA de tallas (sin usar item.tallas.clear())
    if data.tallas is not None:
        tallas_existentes = {t.talla_eur: t for t in item.tallas}
        tallas_enviadas_eur = set()

        for t in data.tallas:
            t_eur = t.talla_eur.strip()
            tallas_enviadas_eur.add(t_eur)

            if t_eur in tallas_existentes:
                t_db = tallas_existentes[t_eur]
                if t.cantidad > t_db.cantidad:
                    # Incremento manual: crear lote para la diferencia
                    dif = t.cantidad - t_db.cantidad
                    costo_lote = Decimal(str(item.costo or 0.0))
                    fecha_lote = item.fecha_ingreso or datetime.utcnow().strftime("%Y-%m-%d")
                    nuevo_lote = InventarioTallaLote(
                        inventario_talla_id=t_db.id,
                        costo_unitario=costo_lote,
                        cantidad_inicial=dif,
                        cantidad_disponible=dif,
                        fecha_ingreso=fecha_lote,
                        observaciones="Ajuste manual de stock",
                        fecha_registro=datetime.utcnow(),
                    )
                    db.add(nuevo_lote)
                elif t.cantidad < t_db.cantidad:
                    # Disminución manual: descontar de lotes disponibles más recientes
                    dif = t_db.cantidad - t.cantidad
                    lotes_rev = sorted(t_db.lotes, key=lambda l: (l.fecha_ingreso, l.id), reverse=True)
                    for l in lotes_rev:
                        if dif <= 0:
                            break
                        red = min(l.cantidad_disponible, dif)
                        l.cantidad_disponible -= red
                        dif -= red
                t_db.cantidad = t.cantidad
            else:
                # Talla nueva agregada en edición
                t_col = MAPPING_TALLAS.get(t_eur, "38")
                t_db = InventarioTalla(
                    inventario_id=item.id,
                    talla_eur=t_eur,
                    talla_col=t_col,
                    cantidad=t.cantidad,
                )
                db.add(t_db)
                db.flush()
                item.tallas.append(t_db)
                if t.cantidad > 0:
                    costo_lote = Decimal(str(item.costo or 0.0))
                    fecha_lote = item.fecha_ingreso or datetime.utcnow().strftime("%Y-%m-%d")
                    nuevo_lote = InventarioTallaLote(
                        inventario_talla_id=t_db.id,
                        costo_unitario=costo_lote,
                        cantidad_inicial=t.cantidad,
                        cantidad_disponible=t.cantidad,
                        fecha_ingreso=fecha_lote,
                        observaciones="Stock inicial de nueva talla",
                        fecha_registro=datetime.utcnow(),
                    )
                    db.add(nuevo_lote)

        # Tallas que existían pero no fueron enviadas: marcar stock 0 para no romper referencias
        for t_eur, t_db in tallas_existentes.items():
            if t_eur not in tallas_enviadas_eur:
                t_db.cantidad = 0
                for l in t_db.lotes:
                    l.cantidad_disponible = 0

    # Calcular estados y rellenar columnas heredadas
    actualizar_estado_y_campos_compatibilidad(item, data.estado)

    db.commit()
    db.refresh(item)
    return item


@router.post("/inventario/{inventario_id}/entradas", response_model=EntradaStockResponse)
def registrar_entrada_stock(
    inventario_id: int,
    data: EntradaStockCreate,
    db: Session = Depends(get_db),
    current_user: str = Depends(get_current_user),
):
    item = db.query(Inventario).filter(Inventario.id == inventario_id).with_for_update().first()
    if not item:
        raise HTTPException(status_code=404, detail="El artículo de inventario no existe")

    tallas_existentes = {t.talla_eur: t for t in item.tallas}
    lotes_creados = 0
    total_unidades = 0

    for entrada in data.items:
        t_eur = entrada.talla_eur.strip()
        cant = entrada.cantidad
        costo_u = Decimal(str(entrada.costo_unitario))

        if t_eur in tallas_existentes:
            talla_db = tallas_existentes[t_eur]
            talla_db.cantidad += cant
        else:
            t_col = MAPPING_TALLAS.get(t_eur, "38")
            talla_db = InventarioTalla(
                inventario_id=item.id,
                talla_eur=t_eur,
                talla_col=t_col,
                cantidad=cant,
            )
            db.add(talla_db)
            db.flush()
            tallas_existentes[t_eur] = talla_db
            item.tallas.append(talla_db)

        # Crear nuevo lote FIFO para esta entrada
        nuevo_lote = InventarioTallaLote(
            inventario_talla_id=talla_db.id,
            costo_unitario=costo_u,
            cantidad_inicial=cant,
            cantidad_disponible=cant,
            fecha_ingreso=data.fecha_ingreso,
            observaciones=data.observaciones or "Entrada de reposición de stock",
            fecha_registro=datetime.utcnow(),
        )
        db.add(nuevo_lote)
        lotes_creados += 1
        total_unidades += cant

        # Actualizar último costo de referencia del producto
        item.costo = float(costo_u)

    # Actualizar estado del producto y campos de compatibilidad
    actualizar_estado_y_campos_compatibilidad(item)
    db.commit()
    db.refresh(item)

    return {
        "mensaje": f"Se ingresaron {total_unidades} unidades exitosamente en {lotes_creados} lotes.",
        "inventario_id": item.id,
        "lotes_creados": lotes_creados,
        "total_unidades_ingresadas": total_unidades,
        "tallas_actualizadas": item.tallas,
    }



@router.delete("/inventario/{inventario_id}")
def eliminar_item_inventario(
    inventario_id: int,
    db: Session = Depends(get_db),
    current_user: str = Depends(get_current_user),
):
    item = db.query(Inventario).filter(Inventario.id == inventario_id).first()
    if not item:
        raise HTTPException(
            status_code=404, detail="El artículo de inventario no existe"
        )

    db.delete(item)
    db.commit()
    return {"mensaje": "Artículo eliminado correctamente del inventario"}


@router.get("/inventario/{inventario_id}/movimientos", response_model=InventarioMovimientosResponse)
def obtener_movimientos_inventario(
    inventario_id: int,
    db: Session = Depends(get_db),
    current_user: str = Depends(get_current_user),
):
    """
    Endpoint de solo lectura para consultar la trazabilidad completa de inventario:
    - Resumen por Talla con capas activas de costo.
    - Historial de Lotes / Reposiciones cronológico con cálculo de valor inicial y disponible.
    - Desglose de ventas/salidas por lote, identificando claramente ventas completadas y anuladas/reintegradas.
    - Carga eager para evitar consultas N+1.
    """
    item = (
        db.query(Inventario)
        .options(
            selectinload(Inventario.tallas)
            .selectinload(InventarioTalla.lotes)
            .selectinload(InventarioTallaLote.consumos)
            .selectinload(VentaLoteConsumo.venta)
            .selectinload(Venta.operacion)
        )
        .filter(Inventario.id == inventario_id)
        .first()
    )

    if not item:
        raise HTTPException(status_code=404, detail="El artículo de inventario no existe")

    resumen_tallas: list[ResumenTallaMovimiento] = []
    historial_lotes: list[LoteMovimientoItem] = []

    total_stock = 0
    valor_inventario_total = Decimal("0.00")

    # Ordenar tallas por mapeo EUR canónico
    tallas_ordenadas = sorted(
        item.tallas,
        key=lambda t: list(MAPPING_TALLAS.keys()).index(t.talla_eur) if t.talla_eur in MAPPING_TALLAS else 999,
    )

    for talla in tallas_ordenadas:
        stock_talla = talla.cantidad or 0
        total_stock += stock_talla

        valor_stock_talla = Decimal("0.00")
        capas_activas: list[CapaActivaItem] = []

        # Ordenar lotes de la talla cronológicamente por fecha_ingreso e id
        lotes_talla = sorted(talla.lotes, key=lambda l: (l.fecha_ingreso, l.id))
        for lote in lotes_talla:
            c_unit = Decimal(str(lote.costo_unitario or Decimal("0.00")))
            disp = lote.cantidad_disponible or 0
            if disp > 0:
                val_capa = Decimal(disp) * c_unit
                valor_stock_talla += val_capa
                capas_activas.append(
                    CapaActivaItem(
                        lote_id=lote.id,
                        cantidad_disponible=disp,
                        costo_unitario=c_unit,
                        fecha_ingreso=lote.fecha_ingreso or "",
                    )
                )

        valor_inventario_total += valor_stock_talla

        resumen_tallas.append(
            ResumenTallaMovimiento(
                talla_id=talla.id,
                talla_eur=talla.talla_eur,
                talla_col=talla.talla_col,
                stock_actual=stock_talla,
                valor_stock=valor_stock_talla,
                capas_activas=capas_activas,
            )
        )

        # Extraer lotes de esta talla para el historial consolidado
        for lote in lotes_talla:
            c_unit = Decimal(str(lote.costo_unitario or Decimal("0.00")))
            c_ini = lote.cantidad_inicial or 0
            c_disp = lote.cantidad_disponible or 0
            consumido_neto = max(0, c_ini - c_disp)
            val_ini = Decimal(c_ini) * c_unit
            val_disp = Decimal(c_disp) * c_unit
            estado_lote = "activo" if c_disp > 0 else "agotado"

            # Salidas / consumos asociados a este lote
            salidas: list[ConsumoSalidaItem] = []
            consumos_ordenados = sorted(
                lote.consumos,
                key=lambda c: (c.fecha_registro or datetime.min, c.id),
                reverse=True,
            )

            for cons in consumos_ordenados:
                v = cons.venta
                num_v = ""
                cli_nombre = None
                est_v = "completada"
                f_anul = None
                m_anul = None
                f_venta = None

                if v:
                    f_venta = v.fecha_venta
                    est_v = v.estado or "completada"
                    if v.fecha_anulacion:
                        f_anul = v.fecha_anulacion.isoformat()
                    m_anul = v.motivo_anulacion
                    if v.operacion:
                        num_v = v.operacion.numero_venta or f"POS-{v.operacion.id}"
                        cli_nombre = v.operacion.cliente_nombre
                    else:
                        num_v = f"V-DIR-{v.id}"
                        cli_nombre = v.cliente_nombre or "Cliente casual"
                else:
                    num_v = f"VENTA-{cons.venta_id}"

                salidas.append(
                    ConsumoSalidaItem(
                        consumo_id=cons.id,
                        venta_id=cons.venta_id,
                        numero_venta=num_v,
                        cantidad=cons.cantidad,
                        costo_unitario=Decimal(str(cons.costo_unitario or c_unit)),
                        costo_total=Decimal(str(cons.costo_total or (Decimal(cons.cantidad) * c_unit))),
                        cliente_nombre=cli_nombre,
                        fecha_venta=f_venta,
                        estado_venta=est_v,
                        fecha_anulacion=f_anul,
                        motivo_anulacion=m_anul,
                    )
                )

            historial_lotes.append(
                LoteMovimientoItem(
                    lote_id=lote.id,
                    fecha_ingreso=lote.fecha_ingreso or "",
                    fecha_registro=lote.fecha_registro,
                    talla_eur=talla.talla_eur,
                    talla_col=talla.talla_col,
                    cantidad_inicial=c_ini,
                    cantidad_disponible=c_disp,
                    cantidad_consumida_neta=consumido_neto,
                    costo_unitario=c_unit,
                    valor_inicial=val_ini,
                    valor_disponible=val_disp,
                    estado=estado_lote,
                    observaciones=lote.observaciones,
                    salidas=salidas,
                )
            )

    # Ordenar historial de lotes por fecha_ingreso descendente, desempate por lote_id desc
    historial_lotes.sort(key=lambda l: (l.fecha_ingreso, l.lote_id), reverse=True)

    header = ProductoMovimientosHeader(
        id=item.id,
        marca=item.marca,
        referencia=item.referencia,
        foto=item.foto,
        precio_sugerido=Decimal(str(item.precio_sugerido or 0.0)),
        stock_total=total_stock,
        valor_inventario_total=valor_inventario_total,
    )

    return InventarioMovimientosResponse(
        producto=header,
        resumen_tallas=resumen_tallas,
        historial_lotes=historial_lotes,
    )


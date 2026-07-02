from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_, func
from app.core.security import get_current_user
from app.database import get_db
from app.models.inventario import Inventario
from app.models.inventario_talla import InventarioTalla
from app.services.utils import normalizar_texto
from app.schemas.inventario import (
    InventarioCreate,
    InventarioUpdate,
    InventarioResponse,
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

    items = query.order_by(Inventario.id.desc()).all()
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
        Inventario.id != inventario_id
    ).first()
    if existente:
        raise HTTPException(
            status_code=400,
            detail="Ya existe otro producto registrado con esta combinación de Marca y Referencia."
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

    # Reemplazar la lista de tallas si se envió
    if data.tallas is not None:
        item.tallas.clear()

        tallas_db = []
        for t in data.tallas:
            t_col = MAPPING_TALLAS.get(t.talla_eur, "38")
            t_db = InventarioTalla(
                talla_eur=t.talla_eur,
                talla_col=t_col,
                cantidad=t.cantidad,
            )
            tallas_db.append(t_db)
        item.tallas = tallas_db

    # Calcular estados y rellenar columnas heredadas
    actualizar_estado_y_campos_compatibilidad(item, data.estado)

    db.commit()
    db.refresh(item)
    return item


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


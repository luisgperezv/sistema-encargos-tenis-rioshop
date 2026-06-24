from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_
from app.core.security import get_current_user
from app.database import get_db
from app.models.inventario import Inventario
from app.schemas.inventario import InventarioCreate, InventarioUpdate, InventarioResponse

router = APIRouter()


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

    if talla_eur:
        query = query.filter(Inventario.talla_eur == talla_eur)

    if talla_col:
        query = query.filter(Inventario.talla_col == talla_col)

    items = query.order_by(Inventario.id.desc()).all()
    return items


@router.get("/inventario/{inventario_id}", response_model=InventarioResponse)
def obtener_item_inventario(
    inventario_id: int,
    db: Session = Depends(get_db),
    current_user: str = Depends(get_current_user),
):
    item = db.query(Inventario).filter(Inventario.id == inventario_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="El artículo de inventario no existe")
    return item


@router.post("/inventario", response_model=InventarioResponse)
def crear_item_inventario(
    data: InventarioCreate,
    db: Session = Depends(get_db),
    current_user: str = Depends(get_current_user),
):
    nuevo_item = Inventario(
        marca=data.marca,
        referencia=data.referencia,
        talla_eur=data.talla_eur,
        talla_col=data.talla_col,
        foto=data.foto,
        costo=data.costo,
        precio_sugerido=data.precio_sugerido,
        cantidad=data.cantidad,
        estado=data.estado,
        fecha_ingreso=data.fecha_ingreso,
        observaciones=data.observaciones,
    )

    # Regla: Si cantidad llega a 0 -> estado="agotado"
    if nuevo_item.cantidad == 0:
        nuevo_item.estado = "agotado"

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
        raise HTTPException(status_code=404, detail="El artículo de inventario no existe")

    old_estado = item.estado

    # Actualizar campos recibidos
    if data.marca is not None:
        item.marca = data.marca
    if data.referencia is not None:
        item.referencia = data.referencia
    if data.talla_eur is not None:
        item.talla_eur = data.talla_eur
    if data.talla_col is not None:
        item.talla_col = data.talla_col
    if data.foto is not None:
        item.foto = data.foto
    if data.costo is not None:
        item.costo = data.costo
    if data.precio_sugerido is not None:
        item.precio_sugerido = data.precio_sugerido
    if data.cantidad is not None:
        item.cantidad = data.cantidad
    if data.estado is not None:
        item.estado = data.estado
    if data.fecha_ingreso is not None:
        item.fecha_ingreso = data.fecha_ingreso
    if data.observaciones is not None:
        item.observaciones = data.observaciones

    # Regla: Si cantidad llega a 0 -> estado="agotado"
    # Regla: Si cantidad vuelve a ser >0 y estaba agotado -> estado="disponible"
    if item.cantidad == 0:
        item.estado = "agotado"
    elif item.cantidad > 0 and old_estado == "agotado":
        # Si se envió un estado explícito válido para cantidad > 0 (ej: reservado), usarlo, sino disponible
        if data.estado and data.estado != "agotado":
            item.estado = data.estado
        else:
            item.estado = "disponible"

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
        raise HTTPException(status_code=404, detail="El artículo de inventario no existe")

    db.delete(item)
    db.commit()
    return {"mensaje": "Artículo eliminado correctamente del inventario"}

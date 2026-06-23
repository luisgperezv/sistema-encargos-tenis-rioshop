from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_
from app.core.security import get_current_user
from app.database import get_db
from app.models.venta import Venta
from app.schemas.venta import VentaResponse

router = APIRouter()


@router.get("/ventas", response_model=list[VentaResponse])
def listar_ventas(
    buscar: str | None = Query(default=None),
    fecha_inicio: str | None = Query(default=None),
    fecha_fin: str | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: str = Depends(get_current_user),
):
    query = db.query(Venta)

    if buscar:
        buscar_term = f"%{buscar}%"
        query = query.filter(
            or_(
                Venta.cliente_nombre.ilike(buscar_term),
                Venta.cliente_telefono.ilike(buscar_term),
                Venta.referencia.ilike(buscar_term),
            )
        )

    if fecha_inicio:
        query = query.filter(Venta.fecha_venta >= fecha_inicio)

    if fecha_fin:
        query = query.filter(Venta.fecha_venta <= fecha_fin)

    ventas = query.order_by(Venta.id.desc()).all()
    return ventas


@router.get("/ventas/{venta_id}", response_model=VentaResponse)
def obtener_venta(
    venta_id: int,
    db: Session = Depends(get_db),
    current_user: str = Depends(get_current_user),
):
    venta = db.query(Venta).filter(Venta.id == venta_id).first()
    if not venta:
        raise HTTPException(status_code=404, detail="La venta no existe")
    return venta

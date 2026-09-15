from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional

from app.core.security import get_current_user
from app.database import get_db
from app.models.gasto import Gasto
from app.schemas.gasto import (
    GastoCreate,
    GastoUpdate,
    GastoResponse,
    GastoResumenResponse,
    GastoResumenCategoria,
    CATEGORIAS_GASTOS,
    METODOS_PAGO_GASTO,
)

router = APIRouter()


# ── Helpers ──────────────────────────────────────────────────────────────────

def _get_or_404(db: Session, gasto_id: int) -> Gasto:
    gasto = db.query(Gasto).filter(Gasto.id == gasto_id).first()
    if not gasto:
        raise HTTPException(status_code=404, detail="Gasto no encontrado")
    return gasto


def _aplicar_filtros(query, fecha_desde: Optional[str], fecha_hasta: Optional[str], categoria: Optional[str]):
    if fecha_desde:
        query = query.filter(Gasto.fecha >= fecha_desde)
    if fecha_hasta:
        query = query.filter(Gasto.fecha <= fecha_hasta)
    if categoria:
        if categoria not in CATEGORIAS_GASTOS:
            raise HTTPException(status_code=422, detail=f"Categoría inválida: {categoria}")
        query = query.filter(Gasto.categoria == categoria)
    return query


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/gastos/categorias")
def listar_categorias(current_user: str = Depends(get_current_user)):
    """Devuelve las categorías y métodos de pago disponibles."""
    return {
        "categorias": CATEGORIAS_GASTOS,
        "metodos_pago": METODOS_PAGO_GASTO,
    }


@router.get("/gastos/resumen", response_model=GastoResumenResponse)
def resumen_gastos(
    fecha_desde: Optional[str] = Query(None),
    fecha_hasta: Optional[str] = Query(None),
    categoria: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: str = Depends(get_current_user),
):
    """Resumen financiero de gastos por período y categoría."""
    q = db.query(Gasto)
    q = _aplicar_filtros(q, fecha_desde, fecha_hasta, categoria)
    gastos = q.all()

    total = sum(g.valor for g in gastos) if gastos else 0

    # Agrupar por categoría
    por_cat: dict[str, dict] = {}
    for g in gastos:
        if g.categoria not in por_cat:
            por_cat[g.categoria] = {"total": 0, "cantidad": 0}
        por_cat[g.categoria]["total"] += g.valor
        por_cat[g.categoria]["cantidad"] += 1

    por_categoria = [
        GastoResumenCategoria(categoria=cat, total=datos["total"], cantidad=datos["cantidad"])
        for cat, datos in sorted(por_cat.items(), key=lambda x: -x[1]["total"])
    ]

    return GastoResumenResponse(
        fecha_desde=fecha_desde,
        fecha_hasta=fecha_hasta,
        categoria=categoria,
        total_gastos=total,
        cantidad_gastos=len(gastos),
        por_categoria=por_categoria,
    )


@router.get("/gastos", response_model=list[GastoResponse])
def listar_gastos(
    fecha_desde: Optional[str] = Query(None),
    fecha_hasta: Optional[str] = Query(None),
    categoria: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: str = Depends(get_current_user),
):
    """Lista gastos con filtros opcionales. Ordenados por fecha descendente."""
    q = db.query(Gasto)
    q = _aplicar_filtros(q, fecha_desde, fecha_hasta, categoria)
    return q.order_by(Gasto.fecha.desc(), Gasto.id.desc()).all()


@router.get("/gastos/{gasto_id}", response_model=GastoResponse)
def obtener_gasto(
    gasto_id: int,
    db: Session = Depends(get_db),
    current_user: str = Depends(get_current_user),
):
    return _get_or_404(db, gasto_id)


@router.post("/gastos", response_model=GastoResponse, status_code=201)
def crear_gasto(
    data: GastoCreate,
    db: Session = Depends(get_db),
    current_user: str = Depends(get_current_user),
):
    nuevo = Gasto(
        fecha=data.fecha,
        categoria=data.categoria,
        descripcion=data.descripcion,
        valor=data.valor,
        metodo_pago=data.metodo_pago,
        observaciones=data.observaciones,
    )
    db.add(nuevo)
    db.commit()
    db.refresh(nuevo)
    return nuevo


@router.put("/gastos/{gasto_id}", response_model=GastoResponse)
def editar_gasto(
    gasto_id: int,
    data: GastoUpdate,
    db: Session = Depends(get_db),
    current_user: str = Depends(get_current_user),
):
    gasto = _get_or_404(db, gasto_id)
    gasto.fecha = data.fecha
    gasto.categoria = data.categoria
    gasto.descripcion = data.descripcion
    gasto.valor = data.valor
    gasto.metodo_pago = data.metodo_pago
    gasto.observaciones = data.observaciones
    db.commit()
    db.refresh(gasto)
    return gasto


@router.delete("/gastos/{gasto_id}")
def eliminar_gasto(
    gasto_id: int,
    db: Session = Depends(get_db),
    current_user: str = Depends(get_current_user),
):
    gasto = _get_or_404(db, gasto_id)
    db.delete(gasto)
    db.commit()
    return {"ok": True, "id": gasto_id}

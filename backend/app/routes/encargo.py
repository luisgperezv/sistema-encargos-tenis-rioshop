from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.encargo import Encargo
from app.models.cliente import Cliente
from app.schemas.encargo import EncargoCreate, EncargoResponse

router = APIRouter()


@router.post("/encargos", response_model=EncargoResponse)
def crear_encargo(encargo: EncargoCreate, db: Session = Depends(get_db)):
    cliente = db.query(Cliente).filter(Cliente.id == encargo.cliente_id).first()

    if not cliente:
        raise HTTPException(status_code=404, detail="El cliente no existe")

    if encargo.precio < 0:
        raise HTTPException(status_code=400, detail="El precio no puede ser negativo")

    if encargo.abono < 0:
        raise HTTPException(status_code=400, detail="El abono no puede ser negativo")

    if encargo.abono > encargo.precio:
        raise HTTPException(status_code=400, detail="El abono no puede ser mayor que el precio")

    saldo = encargo.precio - encargo.abono

    nuevo_encargo = Encargo(
        cliente_id=encargo.cliente_id,
        referencia=encargo.referencia,
        talla_eur=encargo.talla_eur,
        talla_col=encargo.talla_col,
        foto=encargo.foto,
        precio=encargo.precio,
        abono=encargo.abono,
        saldo=saldo,
        estado="pendiente",
        fecha_creacion=encargo.fecha_creacion,
        fecha_entrega_estimada=encargo.fecha_entrega_estimada,
        observaciones=encargo.observaciones
    )

    db.add(nuevo_encargo)
    db.commit()
    db.refresh(nuevo_encargo)

    return nuevo_encargo
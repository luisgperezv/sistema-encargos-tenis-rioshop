from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.encargo import Encargo
from app.models.cliente import Cliente
from app.schemas.encargo import EncargoCreate, EncargoResponse, EncargoEstadoUpdate, EncargoAbonoUpdate
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
    
@router.get("/encargos", response_model=list[EncargoResponse])
def listar_encargos(db: Session = Depends(get_db)):
    encargos = db.query(Encargo).all()
    return encargos


@router.get("/encargos/{encargo_id}", response_model=EncargoResponse)
def obtener_encargo(encargo_id: int, db: Session = Depends(get_db)):
    encargo = db.query(Encargo).filter(Encargo.id == encargo_id).first()

    if not encargo:
        raise HTTPException(status_code=404, detail="El encargo no existe")

    return encargo

    db.add(nuevo_encargo)
    db.commit()
    db.refresh(nuevo_encargo)

    return nuevo_encargo

@router.delete("/encargos/{encargo_id}")
def eliminar_encargo(encargo_id: int, db: Session = Depends(get_db)):
    encargo = db.query(Encargo).filter(Encargo.id == encargo_id).first()

    if not encargo:
        raise HTTPException(status_code=404, detail="El encargo no existe")

    db.delete(encargo)
    db.commit()

    return {"mensaje": "Encargo eliminado correctamente"}

@router.put("/encargos/{encargo_id}/estado", response_model=EncargoResponse)
def actualizar_estado(encargo_id: int, data: EncargoEstadoUpdate, db: Session = Depends(get_db)):
    encargo = db.query(Encargo).filter(Encargo.id == encargo_id).first()

    if not encargo:
        raise HTTPException(status_code=404, detail="El encargo no existe")

    if data.estado == "entregado" and encargo.saldo > 0:
        raise HTTPException(
            status_code=400,
            detail="No se puede entregar un encargo con saldo pendiente"
        )

    encargo.estado = data.estado

    db.commit()
    db.refresh(encargo)

    return encargo

@router.put("/encargos/{encargo_id}/abono", response_model=EncargoResponse)
def actualizar_abono(encargo_id: int, data: EncargoAbonoUpdate, db: Session = Depends(get_db)):
    encargo = db.query(Encargo).filter(Encargo.id == encargo_id).first()

    if not encargo:
        raise HTTPException(status_code=404, detail="El encargo no existe")

    if data.abono <= 0:
        raise HTTPException(status_code=400, detail="El nuevo abono debe ser mayor que 0")

    nuevo_total_abonado = encargo.abono + data.abono

    if nuevo_total_abonado > encargo.precio:
        raise HTTPException(status_code=400, detail="El abono supera el precio total del encargo")

    encargo.abono = nuevo_total_abonado
    encargo.saldo = encargo.precio - encargo.abono

    db.commit()
    db.refresh(encargo)

    return encargo
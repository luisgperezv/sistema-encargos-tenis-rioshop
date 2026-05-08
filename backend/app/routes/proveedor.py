from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.proveedor import Proveedor
from app.schemas.proveedor import ProveedorCreate, ProveedorResponse, ProveedorUpdate
from app.core.security import get_current_user

router = APIRouter()


@router.post("/proveedores", response_model=ProveedorResponse)
def crear_proveedor(
    proveedor: ProveedorCreate,
    db: Session = Depends(get_db),
    current_user: str = Depends(get_current_user)
):
    proveedor_existente = db.query(Proveedor).filter(
        Proveedor.telefono == proveedor.telefono
    ).first()

    if proveedor_existente:
        raise HTTPException(status_code=400, detail="Ya existe un proveedor con ese teléfono")

    nuevo_proveedor = Proveedor(
        nombre=proveedor.nombre,
        telefono=proveedor.telefono
    )

    db.add(nuevo_proveedor)
    db.commit()
    db.refresh(nuevo_proveedor)

    return nuevo_proveedor


@router.get("/proveedores", response_model=list[ProveedorResponse])
def listar_proveedores(
    db: Session = Depends(get_db),
    current_user: str = Depends(get_current_user)
):
    proveedores = db.query(Proveedor).all()
    return proveedores

@router.put("/proveedores/{proveedor_id}", response_model=ProveedorResponse)
def editar_proveedor(
    proveedor_id: int,
    data: ProveedorUpdate,
    db: Session = Depends(get_db),
    current_user: str = Depends(get_current_user)
):
    proveedor = db.query(Proveedor).filter(
        Proveedor.id == proveedor_id
    ).first()

    if not proveedor:
        raise HTTPException(
            status_code=404,
            detail="Proveedor no encontrado"
        )

    proveedor_existente = (
        db.query(Proveedor)
        .filter(
            Proveedor.telefono == data.telefono,
            Proveedor.id != proveedor_id
        )
        .first()
    )

    if proveedor_existente:
        raise HTTPException(
            status_code=400,
            detail="Ya existe otro proveedor con ese teléfono"
        )

    proveedor.nombre = data.nombre
    proveedor.telefono = data.telefono

    db.commit()
    db.refresh(proveedor)

    return proveedor
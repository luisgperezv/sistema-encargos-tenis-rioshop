from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.security import get_current_user

from app.database import get_db
from app.models.cliente import Cliente
from app.schemas.cliente import ClienteCreate, ClienteResponse

router = APIRouter()


@router.post("/clientes", response_model=ClienteResponse)
def crear_cliente(
    cliente: ClienteCreate,
    db: Session = Depends(get_db),
    current_user: str = Depends(get_current_user)
):
    cliente_existente = db.query(Cliente).filter(Cliente.telefono == cliente.telefono).first()

    if cliente_existente:
        raise HTTPException(status_code=400, detail="Ya existe un cliente con ese teléfono")

    nuevo_cliente = Cliente(
        nombre=cliente.nombre,
        telefono=cliente.telefono
    )

    db.add(nuevo_cliente)
    db.commit()
    db.refresh(nuevo_cliente)

    return nuevo_cliente
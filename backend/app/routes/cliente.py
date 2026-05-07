from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.security import get_current_user

from app.database import get_db
from app.models.cliente import Cliente
from app.schemas.cliente import ClienteCreate, ClienteResponse

router = APIRouter()


@router.get("/clientes", response_model=list[ClienteResponse])
def listar_clientes(
    db: Session = Depends(get_db),
    current_user: str = Depends(get_current_user)
):
    clientes = db.query(Cliente).all()
    return clientes


@router.get("/clientes/buscar/{telefono}", response_model=ClienteResponse)
def buscar_cliente_por_telefono(
    telefono: str,
    db: Session = Depends(get_db),
    current_user: str = Depends(get_current_user)
):
    telefono = telefono.strip()
    telefono = telefono.replace(" ", "").replace("-", "").replace("(", "").replace(")", "").replace("+", "")

    if telefono.startswith("57") and len(telefono) > 10:
        telefono = telefono[2:]

    cliente = db.query(Cliente).filter(Cliente.telefono == telefono).first()

    if not cliente:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")

    return cliente


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
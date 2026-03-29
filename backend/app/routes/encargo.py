from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from sqlalchemy.orm import Session
from sqlalchemy import or_, String
import shutil
import os
import uuid
from app.core.security import get_current_user

from datetime import date
from app.database import get_db
from app.models.encargo import Encargo
from app.models.cliente import Cliente
from app.schemas.encargo import EncargoCreate, EncargoResponse, EncargoEstadoUpdate, EncargoAbonoUpdate, EncargoUpdate
router = APIRouter()

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
UPLOADS_DIR = os.path.join(BASE_DIR, "uploads")

ESTADOS_VALIDOS = [
    "pendiente",
    "pedido",
    "despachado",
    "en_local",
    "entregado",
    "cancelado"
]

def validar_finanzas(precio: float, abono: float):
    if precio <= 0:
        raise HTTPException(status_code=400, detail="El precio debe ser mayor a 0")

    if abono < 0:
        raise HTTPException(status_code=400, detail="El abono no puede ser negativo")

    if abono > precio:
        raise HTTPException(status_code=400, detail="El abono no puede ser mayor que el precio")

    saldo = precio - abono

    if saldo < 0:
        raise HTTPException(status_code=400, detail="El saldo no puede ser negativo")

    return saldo


@router.post("/upload")
def subir_imagen(file: UploadFile = File(...)):
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="El archivo debe ser una imagen")

    extension = os.path.splitext(file.filename)[1].lower()

    if extension not in [".jpg", ".jpeg", ".png", ".webp"]:
        raise HTTPException(status_code=400, detail="Formato de imagen no permitido")

    nombre_unico = f"encargo_{uuid.uuid4().hex[:8]}{extension}"
    file_path = os.path.join(UPLOADS_DIR, nombre_unico)

    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    return {
        "mensaje": "Imagen subida correctamente",
        "ruta": f"/uploads/{nombre_unico}"
    }

@router.post("/encargos", response_model=EncargoResponse)
def crear_encargo(
    encargo: EncargoCreate,
    db: Session = Depends(get_db),
    current_user: str = Depends(get_current_user)
):
    cliente = db.query(Cliente).filter(Cliente.id == encargo.cliente_id).first()

    if not cliente:
        raise HTTPException(status_code=404, detail="El cliente no existe")

    saldo = validar_finanzas(encargo.precio, encargo.abono)

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
        fecha_creacion=str(date.today()),
        fecha_entrega_estimada=encargo.fecha_entrega_estimada,
        observaciones=encargo.observaciones
    )

    nuevo_encargo.cliente = cliente

    db.add(nuevo_encargo)
    db.commit()
    db.refresh(nuevo_encargo)

    return nuevo_encargo
    
@router.get("/encargos", response_model=list[EncargoResponse])
def listar_encargos(
    estado: str | None = Query(default=None),
    buscar: str | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: str = Depends(get_current_user)
):
    query = db.query(Encargo).join(Cliente)

    if estado:
        query = query.filter(Encargo.estado == estado)

    if buscar:
        query = query.filter(
            or_(
                Cliente.nombre.ilike(f"%{buscar}%"),
                Encargo.referencia.ilike(f"%{buscar}%"),
                Encargo.id.cast(String).ilike(f"%{buscar}%")
            )
        )

    encargos = query.all()
    return encargos


@router.get("/encargos/{encargo_id}", response_model=EncargoResponse)
def obtener_encargo(
    encargo_id: int,
    db: Session = Depends(get_db),
    current_user: str = Depends(get_current_user)
):
    encargo = db.query(Encargo).filter(Encargo.id == encargo_id).first()

    if not encargo:
        raise HTTPException(status_code=404, detail="El encargo no existe")

    return encargo

@router.delete("/encargos/{encargo_id}")
def eliminar_encargo(encargo_id: int, db: Session = Depends(get_db), current_user: str = Depends(get_current_user)):
    encargo = db.query(Encargo).filter(Encargo.id == encargo_id).first()

    if not encargo:
        raise HTTPException(status_code=404, detail="El encargo no existe")

    db.delete(encargo)
    db.commit()

    return {"mensaje": "Encargo eliminado correctamente"}

@router.put("/encargos/{encargo_id}/estado", response_model=EncargoResponse)
def actualizar_estado(encargo_id: int, data: EncargoEstadoUpdate, db: Session = Depends(get_db), current_user: str = Depends(get_current_user)):
    encargo = db.query(Encargo).filter(Encargo.id == encargo_id).first()

    if not encargo:
        raise HTTPException(status_code=404, detail="El encargo no existe")

    if data.estado not in ESTADOS_VALIDOS:
        raise HTTPException(
            status_code=400,
            detail="Estado no válido"
        )

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
def actualizar_abono(
    encargo_id: int,
    data: EncargoAbonoUpdate,
    db: Session = Depends(get_db),
    current_user: str = Depends(get_current_user)
):
    encargo = db.query(Encargo).filter(Encargo.id == encargo_id).first()

    if not encargo:
        raise HTTPException(status_code=404, detail="El encargo no existe")

    if data.abono <= 0:
        raise HTTPException(status_code=400, detail="El nuevo abono debe ser mayor que 0")

    nuevo_total_abonado = encargo.abono + data.abono
    saldo = validar_finanzas(encargo.precio, nuevo_total_abonado)

    encargo.abono = nuevo_total_abonado
    encargo.saldo = saldo

    db.commit()
    db.refresh(encargo)

    return encargo

@router.put("/encargos/{encargo_id}", response_model=EncargoResponse)
def editar_encargo(
    encargo_id: int,
    data: EncargoUpdate,
    db: Session = Depends(get_db),
    current_user: str = Depends(get_current_user)
):
    encargo = db.query(Encargo).filter(Encargo.id == encargo_id).first()

    if not encargo:
        raise HTTPException(status_code=404, detail="El encargo no existe")

    if encargo.estado == "entregado":
        raise HTTPException(status_code=400, detail="No se puede editar un encargo entregado")

    saldo = validar_finanzas(data.precio, encargo.abono)

    encargo.referencia = data.referencia
    encargo.talla_eur = data.talla_eur
    encargo.talla_col = data.talla_col
    encargo.foto = data.foto
    encargo.precio = data.precio
    encargo.fecha_entrega_estimada = data.fecha_entrega_estimada
    encargo.observaciones = data.observaciones
    encargo.saldo = saldo

    db.commit()
    db.refresh(encargo)

    return encargo
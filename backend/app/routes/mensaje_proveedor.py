from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import desc
from typing import List
from datetime import datetime, timedelta

from app.database import get_db
from app.models.proveedor import Proveedor
from app.models.mensaje_proveedor import MensajeProveedor
from app.schemas.mensaje_proveedor import (
    MensajeProveedorResponse,
    ConversacionProveedorResponse,
    EnviarMensajeRequest,
)
from app.core.security import get_current_user
from app.services.whatsapp import enviar_mensaje_texto

router = APIRouter(
    prefix="/mensajes-proveedores",
    tags=["Mensajes Proveedores"],
    dependencies=[Depends(get_current_user)],
)


@router.get("/conversaciones", response_model=List[ConversacionProveedorResponse])
def listar_conversaciones(db: Session = Depends(get_db)):
    proveedores = db.query(Proveedor).all()
    conversaciones = []

    for prov in proveedores:
        ultimo_mensaje = (
            db.query(MensajeProveedor)
            .filter(MensajeProveedor.proveedor_id == prov.id)
            .order_by(desc(MensajeProveedor.fecha_creacion))
            .first()
        )

        conversaciones.append(
            ConversacionProveedorResponse(
                proveedor_id=prov.id,
                nombre=prov.nombre,
                telefono=prov.telefono,
                ultimo_mensaje=ultimo_mensaje,
                fecha_ultimo_mensaje=ultimo_mensaje.fecha_creacion if ultimo_mensaje else None,
            )
        )

    # Ordenar por fecha_ultimo_mensaje descendente, y luego alfabéticamente si no hay mensaje
    conversaciones.sort(
        key=lambda x: (x.fecha_ultimo_mensaje is not None, x.fecha_ultimo_mensaje),
        reverse=True,
    )

    return conversaciones


@router.get("/{telefono}", response_model=List[MensajeProveedorResponse])
def obtener_mensajes_proveedor(telefono: str, db: Session = Depends(get_db)):
    mensajes = (
        db.query(MensajeProveedor)
        .filter(MensajeProveedor.telefono == telefono)
        .order_by(MensajeProveedor.fecha_creacion.asc())
        .all()
    )
    return mensajes


@router.post("/enviar", response_model=MensajeProveedorResponse)
def enviar_mensaje_proveedor(request: EnviarMensajeRequest, db: Session = Depends(get_db)):
    # Validar que el proveedor existe
    proveedor = db.query(Proveedor).filter(Proveedor.telefono == request.telefono).first()
    if not proveedor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Proveedor no encontrado con ese teléfono.",
        )

    # Obtener el último mensaje entrante del proveedor
    ultimo_mensaje_entrante = (
        db.query(MensajeProveedor)
        .filter(
            MensajeProveedor.proveedor_id == proveedor.id,
            MensajeProveedor.direccion == "entrante",
        )
        .order_by(desc(MensajeProveedor.fecha_creacion))
        .first()
    )

    if not ultimo_mensaje_entrante:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No se puede enviar mensaje libre. El proveedor no ha iniciado una conversación.",
        )

    # Validar ventana de 24 horas
    ahora = datetime.utcnow()
    diferencia = ahora - ultimo_mensaje_entrante.fecha_creacion
    if diferencia > timedelta(hours=24):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La ventana de 24 horas expiró. Se requiere plantilla aprobada para reabrir conversación.",
        )

    # Enviar mensaje vía WhatsApp
    respuesta_ws = enviar_mensaje_texto(request.telefono, request.contenido)
    
    # Manejar errores de WhatsApp si los hay
    if "error" in respuesta_ws:
        error_msg = respuesta_ws.get("error", {}).get("message", "Error desconocido de WhatsApp")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al enviar mensaje por WhatsApp: {error_msg}",
        )

    # Guardar en base de datos
    nuevo_mensaje = MensajeProveedor(
        proveedor_id=proveedor.id,
        telefono=proveedor.telefono,
        direccion="saliente",
        tipo="text",
        contenido=request.contenido,
        whatsapp_message_id=respuesta_ws.get("messages", [{}])[0].get("id"),
        fecha_creacion=ahora,
    )
    db.add(nuevo_mensaje)
    db.commit()
    db.refresh(nuevo_mensaje)

    return nuevo_mensaje

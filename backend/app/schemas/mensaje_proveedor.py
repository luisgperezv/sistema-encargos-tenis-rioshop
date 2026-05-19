from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class MensajeProveedorBase(BaseModel):
    telefono: str
    nombre_perfil: Optional[str] = None
    direccion: str
    tipo: str
    contenido: Optional[str] = None
    whatsapp_message_id: Optional[str] = None


class MensajeProveedorCreate(MensajeProveedorBase):
    proveedor_id: Optional[int] = None


class MensajeProveedorResponse(MensajeProveedorBase):
    id: int
    proveedor_id: Optional[int] = None
    fecha_creacion: datetime

    class Config:
        from_attributes = True


class ConversacionProveedorResponse(BaseModel):
    proveedor_id: int
    nombre: str
    telefono: str
    ultimo_mensaje: Optional[MensajeProveedorResponse] = None
    fecha_ultimo_mensaje: Optional[datetime] = None


class EnviarMensajeRequest(BaseModel):
    telefono: str
    contenido: str

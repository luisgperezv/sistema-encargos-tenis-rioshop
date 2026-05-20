from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base


class MensajeProveedor(Base):
    __tablename__ = "mensajes_proveedores"

    id = Column(Integer, primary_key=True, index=True)
    proveedor_id = Column(Integer, ForeignKey("proveedores.id"), nullable=True)
    telefono = Column(String, index=True, nullable=False)
    nombre_perfil = Column(String, nullable=True)
    direccion = Column(String, nullable=False)  # "entrante" o "saliente"
    tipo = Column(String, nullable=False, default="text")  # "text", "image", "audio", "document", "unknown"
    contenido = Column(Text, nullable=True)
    media_url = Column(String, nullable=True)
    whatsapp_message_id = Column(String, unique=True, nullable=True)
    reply_to_whatsapp_message_id = Column(String, nullable=True)
    reply_to_text = Column(Text, nullable=True)
    reply_to_media_url = Column(String, nullable=True)
    fecha_creacion = Column(DateTime, default=datetime.utcnow)


    proveedor = relationship("Proveedor")

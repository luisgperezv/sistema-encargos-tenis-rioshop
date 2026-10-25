from datetime import datetime

from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, BigInteger
from app.database import Base


# Orden de progreso de los estados de WhatsApp. "failed" es terminal y se trata aparte.
ESTADOS_WHATSAPP_RANGO = {
    "pendiente": -1,  # registro creado localmente, aún sin respuesta de Meta
    "accepted": 0,    # Meta aceptó la solicitud (HTTP 200). NO implica entrega.
    "sent": 1,
    "delivered": 2,
    "read": 3,
}
ESTADO_FALLIDO = "failed"
ESTADO_INCIERTO = "incierto"


class NotificacionWhatsapp(Base):
    """
    Historial de intentos de notificación por WhatsApp asociados a un encargo.
    Cada intento (incluidos reintentos manuales) genera una fila nueva: nunca se
    sobrescribe el historial. El estado se actualiza vía webhook usando el wamid.
    """

    __tablename__ = "notificaciones_whatsapp"

    id = Column(Integer, primary_key=True, index=True)
    encargo_id = Column(Integer, ForeignKey("encargos.id", ondelete="SET NULL"), index=True, nullable=True)
    destinatario = Column(String(20), nullable=False)  # "cliente" | "proveedor"
    proveedor_id = Column(Integer, nullable=True)
    tipo = Column(String(50), nullable=False)  # "confirmacion" | "proveedor" | "en_local"
    plantilla = Column(String(100), nullable=True)
    intento = Column(Integer, nullable=False, default=1)

    wamid = Column(String, unique=True, index=True, nullable=True)
    estado = Column(String(20), nullable=False, default="pendiente")
    error_codigo = Column(String(20), nullable=True)
    error_mensaje = Column(Text, nullable=True)

    media_url_enviada = Column(String, nullable=True)
    media_bytes = Column(Integer, nullable=True)

    ultimo_timestamp_meta = Column(BigInteger, nullable=True)
    fecha_creacion = Column(DateTime, default=datetime.utcnow, nullable=False)
    fecha_actualizacion = Column(DateTime, default=datetime.utcnow, nullable=False)


class EstadoWebhookPendiente(Base):
    """
    Almacena estados recibidos por el webhook cuyo wamid aún no se ha guardado
    en notificaciones_whatsapp (ej. webhook que llega milisegundos antes de que
    el hilo emisor termine su db.commit()).
    Al persistir la notificación, se consumen y eliminan de forma atómica y sin
    bloqueos del event loop (sin time.sleep).
    """

    __tablename__ = "estados_webhook_pendientes"

    id = Column(Integer, primary_key=True, index=True)
    wamid = Column(String, unique=True, index=True, nullable=False)
    estado = Column(String(20), nullable=False)
    ultimo_timestamp_meta = Column(BigInteger, nullable=True)
    error_codigo = Column(String(20), nullable=True)
    error_mensaje = Column(Text, nullable=True)
    fecha_creacion = Column(DateTime, default=datetime.utcnow, nullable=False)

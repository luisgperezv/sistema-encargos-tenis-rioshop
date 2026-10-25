from sqlalchemy import Column, Integer, String, Float, ForeignKey
from sqlalchemy.orm import relationship
from app.database import Base


class Encargo(Base):
    __tablename__ = "encargos"

    id = Column(Integer, primary_key=True, index=True)

    cliente_id = Column(Integer, ForeignKey("clientes.id"), nullable=False)
    proveedor_id = Column(Integer, ForeignKey("proveedores.id"), nullable=True)

    referencia = Column(String, nullable=False)

    talla_eur = Column(String, nullable=False)
    talla_col = Column(String, nullable=False)

    foto = Column(String, nullable=True)

    precio = Column(Float, nullable=False)
    abono = Column(Float, default=0, nullable=False)
    saldo = Column(Float, nullable=False)

    estado = Column(String, default="pendiente", nullable=False)

    fecha_creacion = Column(String, nullable=False)
    fecha_entrega_estimada = Column(String, nullable=True)

    observaciones = Column(String, nullable=True)

    costo_base = Column(Float, nullable=True)
    costo_envio = Column(Float, nullable=True)
    costo_despachador = Column(Float, nullable=True)
    costo_total = Column(Float, nullable=True)
    utilidad_estimada = Column(Float, nullable=True)
    fecha_despacho = Column(String, nullable=True)
    fecha_entregado = Column(String, nullable=True)
    motivo_cancelacion = Column(String, nullable=True)
    fecha_cancelacion = Column(String, nullable=True)
    metodo_pago = Column(String, nullable=True)

    cliente = relationship("Cliente", back_populates="encargos")
    proveedor = relationship("Proveedor", back_populates="encargos")

    # Historial de notificaciones WhatsApp (solo lectura desde aquí).
    notificaciones_whatsapp = relationship(
        "NotificacionWhatsapp",
        primaryjoin="Encargo.id == foreign(NotificacionWhatsapp.encargo_id)",
        order_by="NotificacionWhatsapp.id",
        viewonly=True,
        lazy="selectin",
    )

    def _ultima_notificacion(self, destinatario: str):
        notifs = [n for n in (self.notificaciones_whatsapp or []) if n.destinatario == destinatario]
        if not notifs:
            return None
        n = notifs[-1]
        return {
            "estado": n.estado,
            "tipo": n.tipo,
            "intento": n.intento,
            "total_intentos": len(notifs),
            "error_codigo": n.error_codigo,
            "error_mensaje": n.error_mensaje,
            "fecha_actualizacion": n.fecha_actualizacion,
        }

    @property
    def whatsapp_cliente(self):
        return self._ultima_notificacion("cliente")

    @property
    def whatsapp_proveedor(self):
        return self._ultima_notificacion("proveedor")


# Registrar el modelo para que SQLAlchemy resuelva la relación por nombre.
from app.models import notificacion_whatsapp as _notificacion_whatsapp  # noqa: E402,F401

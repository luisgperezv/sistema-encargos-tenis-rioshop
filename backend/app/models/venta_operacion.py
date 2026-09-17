from sqlalchemy import Column, Integer, String, Numeric, DateTime
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base


class VentaOperacion(Base):
    __tablename__ = "venta_operaciones"

    id = Column(Integer, primary_key=True, index=True)
    numero_venta = Column(String, unique=True, index=True, nullable=False)
    idempotency_key = Column(String(64), nullable=True)
    cliente_id = Column(Integer, nullable=True)
    cliente_nombre = Column(String, nullable=True)
    cliente_telefono = Column(String, nullable=True)
    metodo_pago = Column(String, nullable=False)
    total_bruto = Column(Numeric(12, 2), nullable=False)
    costo_total = Column(Numeric(12, 2), nullable=False)
    utilidad_total = Column(Numeric(12, 2), nullable=False)
    cantidad_items = Column(Integer, nullable=False)
    origen = Column(String, nullable=False, default="inventario")
    observaciones = Column(String, nullable=True)
    fecha_venta = Column(DateTime, nullable=False, default=datetime.utcnow)
    fecha_registro = Column(DateTime, nullable=False, default=datetime.utcnow)
    estado = Column(String(20), nullable=False, default="completada", index=True)
    fecha_anulacion = Column(DateTime, nullable=True)
    motivo_anulacion = Column(String, nullable=True)
    usuario_anulacion = Column(String, nullable=True)

    detalles = relationship("Venta", back_populates="operacion", cascade="all, delete-orphan")

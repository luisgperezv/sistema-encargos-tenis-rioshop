from sqlalchemy import Column, Integer, String, Numeric, DateTime
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base


class VentaOperacion(Base):
    __tablename__ = "venta_operaciones"

    id = Column(Integer, primary_key=True, index=True)
    numero_venta = Column(String, unique=True, index=True, nullable=False)
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

    detalles = relationship("Venta", back_populates="operacion", cascade="all, delete-orphan")

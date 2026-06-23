from sqlalchemy import Column, Integer, String, Float, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base


class Venta(Base):
    __tablename__ = "ventas"

    id = Column(Integer, primary_key=True, index=True)
    encargo_id = Column(Integer, ForeignKey("encargos.id"), unique=True, nullable=True, index=True)

    # Snapshot del Cliente (inmutable)
    cliente_id = Column(Integer, nullable=False)
    cliente_nombre = Column(String, nullable=False)
    cliente_telefono = Column(String, nullable=False)

    # Snapshot del Proveedor (inmutable, opcional)
    proveedor_id = Column(Integer, nullable=True)
    proveedor_nombre = Column(String, nullable=True)
    proveedor_telefono = Column(String, nullable=True)

    # Snapshot del Calzado
    referencia = Column(String, nullable=False)
    talla_eur = Column(String, nullable=False)
    talla_col = Column(String, nullable=False)
    foto = Column(String, nullable=True)

    # Datos Financieros
    precio_venta = Column(Float, nullable=False)
    costo_base = Column(Float, nullable=False)
    costo_envio = Column(Float, nullable=False)
    costo_despachador = Column(Float, nullable=False)
    costo_total = Column(Float, nullable=False)
    utilidad = Column(Float, nullable=False)

    # Datos de la Venta
    metodo_pago = Column(String, nullable=False)
    fecha_venta = Column(String, nullable=False)  # YYYY-MM-DD
    origen = Column(String, nullable=False, default="encargo")
    fecha_registro = Column(DateTime, default=datetime.utcnow)

    # Relación de auditoría con la tabla encargos (soporta nulos si se elimina el encargo)
    encargo = relationship("Encargo")

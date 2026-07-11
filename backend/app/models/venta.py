from sqlalchemy import Column, Integer, String, Float, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base


class Venta(Base):
    __tablename__ = "ventas"

    id = Column(Integer, primary_key=True, index=True)
    encargo_id = Column(Integer, ForeignKey("encargos.id"), unique=True, nullable=True, index=True)

    # Snapshot del Cliente (inmutable)
    cliente_id = Column(Integer, nullable=True)
    cliente_nombre = Column(String, nullable=True)
    cliente_telefono = Column(String, nullable=True)

    # Snapshot del Proveedor (inmutable, opcional)
    proveedor_id = Column(Integer, nullable=True)
    proveedor_nombre = Column(String, nullable=True)
    proveedor_telefono = Column(String, nullable=True)

    # Snapshot del Calzado
    marca = Column(String, nullable=True)
    referencia = Column(String, nullable=True)
    talla_eur = Column(String, nullable=True)
    talla_col = Column(String, nullable=True)
    foto = Column(String, nullable=True)

    # Relaciones con Inventario
    inventario_id = Column(Integer, ForeignKey("inventario.id"), nullable=True, index=True)
    inventario_talla_id = Column(Integer, ForeignKey("inventario_tallas.id"), nullable=True, index=True)
    operacion_id = Column(Integer, ForeignKey("venta_operaciones.id"), nullable=True, index=True)

    # Datos Financieros
    cantidad = Column(Integer, default=1, nullable=True)
    precio_unitario = Column(Float, nullable=True)
    subtotal = Column(Float, nullable=True)
    precio_venta = Column(Float, nullable=True)
    costo_base = Column(Float, nullable=True)
    costo_envio = Column(Float, nullable=True)
    costo_despachador = Column(Float, nullable=True)
    costo_total = Column(Float, nullable=True)
    utilidad = Column(Float, nullable=True)

    # Datos de la Venta
    metodo_pago = Column(String, nullable=True)
    fecha_venta = Column(String, nullable=True)  # YYYY-MM-DD
    origen = Column(String, nullable=False, default="encargo")
    observaciones = Column(String, nullable=True)
    fecha_registro = Column(DateTime, default=datetime.utcnow)

    # Relación de auditoría (soporta nulos si se elimina el encargo o producto)
    encargo = relationship("Encargo")
    inventario = relationship("Inventario")
    inventario_talla = relationship("InventarioTalla")
    operacion = relationship("VentaOperacion", back_populates="detalles")

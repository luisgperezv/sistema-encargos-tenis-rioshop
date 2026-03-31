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

    foto = Column(String, nullable=False)

    precio = Column(Float, nullable=False)
    abono = Column(Float, default=0, nullable=False)
    saldo = Column(Float, nullable=False)

    estado = Column(String, default="pendiente", nullable=False)

    fecha_creacion = Column(String, nullable=False)
    fecha_entrega_estimada = Column(String, nullable=True)

    observaciones = Column(String, nullable=True)

    cliente = relationship("Cliente", back_populates="encargos")
    proveedor = relationship("Proveedor", back_populates="encargos")
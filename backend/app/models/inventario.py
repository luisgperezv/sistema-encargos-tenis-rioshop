from sqlalchemy import Column, Integer, String, Float, DateTime
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base


class Inventario(Base):
    __tablename__ = "inventario"

    id = Column(Integer, primary_key=True, index=True)
    marca = Column(String, nullable=False)
    referencia = Column(String, nullable=False)
    talla_eur = Column(String, nullable=True)  # nullable=True para compatibilidad
    talla_col = Column(String, nullable=True)  # nullable=True para compatibilidad
    foto = Column(String, nullable=True)
    costo = Column(Float, nullable=False)
    precio_sugerido = Column(Float, nullable=False)
    cantidad = Column(Integer, nullable=True, default=1)  # nullable=True para compatibilidad
    estado = Column(String, nullable=False, default="disponible")  # disponible, agotado, reservado
    fecha_ingreso = Column(String, nullable=False)  # YYYY-MM-DD
    observaciones = Column(String, nullable=True)
    fecha_registro = Column(DateTime, default=datetime.utcnow)

    tallas = relationship(
        "InventarioTalla",
        back_populates="inventario",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )

    @property
    def cantidad_total(self) -> int:
        if not self.tallas:
            return self.cantidad or 0
        return sum(t.cantidad for t in self.tallas)


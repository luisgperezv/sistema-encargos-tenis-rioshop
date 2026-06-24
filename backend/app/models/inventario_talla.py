from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base


class InventarioTalla(Base):
    __tablename__ = "inventario_tallas"

    id = Column(Integer, primary_key=True, index=True)
    inventario_id = Column(
        Integer,
        ForeignKey("inventario.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    talla_eur = Column(String, nullable=False)
    talla_col = Column(String, nullable=False)
    cantidad = Column(Integer, nullable=False, default=0)
    fecha_registro = Column(DateTime, default=datetime.utcnow)

    inventario = relationship("Inventario", back_populates="tallas")

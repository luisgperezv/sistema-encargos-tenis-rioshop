from sqlalchemy import Column, Integer, String, Numeric, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base


class InventarioTallaLote(Base):
    __tablename__ = "inventario_talla_lotes"

    id = Column(Integer, primary_key=True, index=True)
    inventario_talla_id = Column(
        Integer,
        ForeignKey("inventario_tallas.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    costo_unitario = Column(Numeric(12, 2), nullable=False)
    cantidad_inicial = Column(Integer, nullable=False)
    cantidad_disponible = Column(Integer, nullable=False, default=0)
    fecha_ingreso = Column(String, nullable=False, index=True)  # YYYY-MM-DD
    observaciones = Column(String, nullable=True)
    fecha_registro = Column(DateTime, default=datetime.utcnow)

    talla = relationship("InventarioTalla", back_populates="lotes")
    consumos = relationship("VentaLoteConsumo", back_populates="lote")

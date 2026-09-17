from sqlalchemy import Column, Integer, Numeric, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base


class VentaLoteConsumo(Base):
    __tablename__ = "venta_lote_consumos"

    id = Column(Integer, primary_key=True, index=True)
    venta_id = Column(
        Integer,
        ForeignKey("ventas.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    lote_id = Column(
        Integer,
        ForeignKey("inventario_talla_lotes.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    cantidad = Column(Integer, nullable=False)
    costo_unitario = Column(Numeric(12, 2), nullable=False)
    costo_total = Column(Numeric(12, 2), nullable=False)
    fecha_registro = Column(DateTime, default=datetime.utcnow)

    venta = relationship("Venta", back_populates="lote_consumos")
    lote = relationship("InventarioTallaLote", back_populates="consumos")

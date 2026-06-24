from sqlalchemy import Column, Integer, String, Float, DateTime
from datetime import datetime
from app.database import Base


class Inventario(Base):
    __tablename__ = "inventario"

    id = Column(Integer, primary_key=True, index=True)
    marca = Column(String, nullable=False)
    referencia = Column(String, nullable=False)
    talla_eur = Column(String, nullable=False)
    talla_col = Column(String, nullable=False)
    foto = Column(String, nullable=True)
    costo = Column(Float, nullable=False)
    precio_sugerido = Column(Float, nullable=False)
    cantidad = Column(Integer, nullable=False, default=1)
    estado = Column(String, nullable=False, default="disponible")  # disponible, agotado, reservado
    fecha_ingreso = Column(String, nullable=False)  # YYYY-MM-DD
    observaciones = Column(String, nullable=True)
    fecha_registro = Column(DateTime, default=datetime.utcnow)

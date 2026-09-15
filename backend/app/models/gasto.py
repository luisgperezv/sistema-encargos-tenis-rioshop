from sqlalchemy import Column, Integer, BigInteger, String, DateTime
from datetime import datetime
from app.database import Base


class Gasto(Base):
    __tablename__ = "gastos"

    id = Column(Integer, primary_key=True, index=True)

    # Cuándo ocurrió el gasto (YYYY-MM-DD, nunca futura)
    fecha = Column(String, nullable=False)

    # Categoría controlada (validada en el schema)
    categoria = Column(String, nullable=False)

    # Descripción libre obligatoria
    descripcion = Column(String, nullable=False)

    # Valor en pesos COP enteros sin centavos (BigInteger para máxima seguridad)
    valor = Column(BigInteger, nullable=False)

    # Método de pago controlado
    metodo_pago = Column(String, nullable=False)

    # Notas adicionales opcionales
    observaciones = Column(String, nullable=True)

    # Auditoría: fecha/hora exacta de registro en el sistema
    fecha_registro = Column(DateTime, default=datetime.utcnow, nullable=False)

from pydantic import BaseModel


class EncargoCreate(BaseModel):
    cliente_id: int
    referencia: str

    talla_eur: str
    talla_col: str

    foto: str

    precio: float
    abono: float = 0

    fecha_creacion: str
    fecha_entrega_estimada: str | None = None

    observaciones: str | None = None


class EncargoResponse(BaseModel):
    id: int
    cliente_id: int
    referencia: str

    talla_eur: str
    talla_col: str

    foto: str

    precio: float
    abono: float
    saldo: float

    estado: str

    fecha_creacion: str
    fecha_entrega_estimada: str | None = None

    observaciones: str | None = None

    class Config:
        from_attributes = True
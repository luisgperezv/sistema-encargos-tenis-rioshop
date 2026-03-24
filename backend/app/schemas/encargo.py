from pydantic import BaseModel


class ClienteMiniResponse(BaseModel):
    id: int
    nombre: str
    telefono: str

    class Config:
        from_attributes = True


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
    cliente: ClienteMiniResponse

    class Config:
        from_attributes = True

class EncargoEstadoUpdate(BaseModel):
    estado: str

class EncargoAbonoUpdate(BaseModel):
    abono: float
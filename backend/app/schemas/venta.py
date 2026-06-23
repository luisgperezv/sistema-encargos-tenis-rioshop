from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class VentaResponse(BaseModel):
    id: int
    encargo_id: Optional[int] = None
    cliente_id: int
    cliente_nombre: str
    cliente_telefono: str
    proveedor_id: Optional[int] = None
    proveedor_nombre: Optional[str] = None
    proveedor_telefono: Optional[str] = None
    referencia: str
    talla_eur: str
    talla_col: str
    foto: Optional[str] = None
    precio_venta: float
    costo_base: float
    costo_envio: float
    costo_despachador: float
    costo_total: float
    utilidad: float
    metodo_pago: str
    fecha_venta: str
    origen: str
    fecha_registro: datetime

    class Config:
        from_attributes = True

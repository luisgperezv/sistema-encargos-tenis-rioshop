from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class VentaDirectaCreate(BaseModel):
    inventario_talla_id: int
    cantidad: int = 1
    precio_unitario: float
    metodo_pago: str
    cliente_nombre: Optional[str] = None
    cliente_telefono: Optional[str] = None
    observaciones: Optional[str] = None


class VentaResponse(BaseModel):
    id: int
    encargo_id: Optional[int] = None
    inventario_id: Optional[int] = None
    inventario_talla_id: Optional[int] = None
    cliente_id: Optional[int] = None
    cliente_nombre: Optional[str] = None
    cliente_telefono: Optional[str] = None
    proveedor_id: Optional[int] = None
    proveedor_nombre: Optional[str] = None
    proveedor_telefono: Optional[str] = None
    marca: Optional[str] = None
    referencia: Optional[str] = None
    talla_eur: Optional[str] = None
    talla_col: Optional[str] = None
    foto: Optional[str] = None
    cantidad: Optional[int] = 1
    precio_unitario: Optional[float] = None
    subtotal: Optional[float] = None
    precio_venta: Optional[float] = None
    costo_base: Optional[float] = None
    costo_envio: Optional[float] = None
    costo_despachador: Optional[float] = None
    costo_total: Optional[float] = None
    utilidad: Optional[float] = None
    metodo_pago: Optional[str] = None
    fecha_venta: Optional[str] = None
    origen: str
    observaciones: Optional[str] = None
    fecha_registro: datetime

    class Config:
        from_attributes = True

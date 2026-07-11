from pydantic import BaseModel, Field, field_validator
from typing import Optional, List
from datetime import datetime
from decimal import Decimal


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
    operacion_id: Optional[int] = None
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


class VentaCheckoutItem(BaseModel):
    inventario_talla_id: int
    cantidad: int = Field(..., gt=0)
    precio_unitario: Decimal = Field(..., gt=0)


class VentaCheckoutCreate(BaseModel):
    items: List[VentaCheckoutItem]
    metodo_pago: str
    cliente_id: Optional[int] = None
    cliente_nombre: Optional[str] = None
    cliente_telefono: Optional[str] = None
    observaciones: Optional[str] = None

    @field_validator("items")
    @classmethod
    def validar_items(cls, value: List[VentaCheckoutItem]):
        if not value or len(value) == 0:
            raise ValueError("Debe incluir al menos un ítem para realizar el checkout.")
        return value

    @field_validator("metodo_pago")
    @classmethod
    def validar_metodo_pago(cls, value: str):
        if not value or not value.strip():
            raise ValueError("El método de pago es obligatorio.")
        return value.strip()


class VentaOperacionResponse(BaseModel):
    id: int
    numero_venta: str
    cliente_id: Optional[int] = None
    cliente_nombre: Optional[str] = None
    cliente_telefono: Optional[str] = None
    metodo_pago: str
    total_bruto: Decimal
    costo_total: Decimal
    utilidad_total: Decimal
    cantidad_items: int
    origen: str
    observaciones: Optional[str] = None
    fecha_venta: datetime
    fecha_registro: datetime

    class Config:
        from_attributes = True


class VentaCheckoutResponse(BaseModel):
    operacion: VentaOperacionResponse
    detalles: List[VentaResponse]
    total_bruto: Decimal
    costo_total: Decimal
    utilidad_total: Decimal
    cantidad_items: int

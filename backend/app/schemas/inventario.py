from pydantic import BaseModel, field_validator
from typing import Optional
from datetime import datetime


class InventarioBase(BaseModel):
    marca: str
    referencia: str
    talla_eur: str
    talla_col: str
    foto: Optional[str] = None
    costo: float
    precio_sugerido: float
    cantidad: int = 1
    estado: str = "disponible"
    fecha_ingreso: str
    observaciones: Optional[str] = None

    @field_validator("marca")
    @classmethod
    def limpiar_marca(cls, value: str):
        value = value.strip()
        if not value:
            raise ValueError("La marca es obligatoria")
        return value

    @field_validator("referencia")
    @classmethod
    def limpiar_referencia(cls, value: str):
        value = value.strip()
        if not value:
            raise ValueError("La referencia es obligatoria")
        return value

    @field_validator("talla_eur")
    @classmethod
    def limpiar_talla_eur(cls, value: str):
        value = value.strip()
        if not value:
            raise ValueError("La talla EUR es obligatoria")
        return value

    @field_validator("talla_col")
    @classmethod
    def limpiar_talla_col(cls, value: str):
        value = value.strip()
        if not value:
            raise ValueError("La talla COL es obligatoria")
        return value

    @field_validator("costo")
    @classmethod
    def validar_costo(cls, value: float):
        if value < 0:
            raise ValueError("El costo no puede ser negativo")
        return value

    @field_validator("precio_sugerido")
    @classmethod
    def validar_precio(cls, value: float):
        if value < 0:
            raise ValueError("El precio sugerido no puede ser negativo")
        return value

    @field_validator("cantidad")
    @classmethod
    def validar_cantidad(cls, value: int):
        if value < 0:
            raise ValueError("La cantidad no puede ser negativa")
        return value

    @field_validator("estado")
    @classmethod
    def validar_estado(cls, value: str):
        estados_validos = ["disponible", "agotado", "reservado"]
        value = value.strip().lower()
        if value not in estados_validos:
            raise ValueError(f"Estado no válido. Debe ser uno de: {', '.join(estados_validos)}")
        return value


class InventarioCreate(InventarioBase):
    pass


class InventarioUpdate(BaseModel):
    marca: Optional[str] = None
    referencia: Optional[str] = None
    talla_eur: Optional[str] = None
    talla_col: Optional[str] = None
    foto: Optional[str] = None
    costo: Optional[float] = None
    precio_sugerido: Optional[float] = None
    cantidad: Optional[int] = None
    estado: Optional[str] = None
    fecha_ingreso: Optional[str] = None
    observaciones: Optional[str] = None

    @field_validator("marca", "referencia", "talla_eur", "talla_col")
    @classmethod
    def limpiar_campos_texto(cls, value: Optional[str]):
        if value is not None:
            value = value.strip()
            if not value:
                raise ValueError("El campo no puede estar vacío")
        return value

    @field_validator("costo")
    @classmethod
    def validar_costo(cls, value: Optional[float]):
        if value is not None and value < 0:
            raise ValueError("El costo no puede ser negativo")
        return value

    @field_validator("precio_sugerido")
    @classmethod
    def validar_precio(cls, value: Optional[float]):
        if value is not None and value < 0:
            raise ValueError("El precio sugerido no puede ser negativo")
        return value

    @field_validator("cantidad")
    @classmethod
    def validar_cantidad(cls, value: Optional[int]):
        if value is not None and value < 0:
            raise ValueError("La cantidad no puede ser negativa")
        return value

    @field_validator("estado")
    @classmethod
    def validar_estado(cls, value: Optional[str]):
        if value is not None:
            estados_validos = ["disponible", "agotado", "reservado"]
            value = value.strip().lower()
            if value not in estados_validos:
                raise ValueError(f"Estado no válido. Debe ser uno de: {', '.join(estados_validos)}")
        return value


class InventarioResponse(InventarioBase):
    id: int
    fecha_registro: datetime

    class Config:
        from_attributes = True

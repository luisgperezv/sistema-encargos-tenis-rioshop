from pydantic import BaseModel, Field, field_validator
from typing import Optional
from datetime import datetime


# Mapeo oficial de tallas EUR a COL.
# Nota sobre nomenclatura: "D" equivale a Dama/Mujer, "H" equivale a Hombre.
MAPPING_TALLAS = {
    "36": "35",
    "37": "36",
    "38": "37",
    "39": "38",
    "40D": "39",
    "40H": "38",
    "41D": "40",
    "41H": "39",
    "42": "40",
    "43": "41",
    "44": "42",
    "45": "43",
}



from decimal import Decimal


class InventarioTallaLoteResponse(BaseModel):
    id: int
    inventario_talla_id: int
    costo_unitario: Decimal
    cantidad_inicial: int
    cantidad_disponible: int
    fecha_ingreso: str
    observaciones: Optional[str] = None
    fecha_registro: datetime

    class Config:
        from_attributes = True


class InventarioTallaBase(BaseModel):
    talla_eur: str
    cantidad: int = 0

    @field_validator("talla_eur")
    @classmethod
    def validar_talla_eur(cls, value: str):
        value = value.strip()
        if value not in MAPPING_TALLAS:
            raise ValueError(
                f"Talla EUR no válida. Debe ser una de: {', '.join(MAPPING_TALLAS.keys())}"
            )
        return value

    @field_validator("cantidad")
    @classmethod
    def validar_cantidad(cls, value: int):
        if value < 0:
            raise ValueError("La cantidad no puede ser negativa")
        return value


class InventarioTallaCreate(InventarioTallaBase):
    pass


class InventarioTallaResponse(InventarioTallaBase):
    id: int
    inventario_id: int
    talla_col: str
    fecha_registro: datetime
    lotes: list[InventarioTallaLoteResponse] = []

    class Config:
        from_attributes = True



class InventarioBase(BaseModel):
    marca: str
    referencia: str
    talla_eur: Optional[str] = None
    talla_col: Optional[str] = None
    foto: Optional[str] = None
    costo: float
    precio_sugerido: float
    cantidad: Optional[int] = 1
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

    @field_validator("talla_eur", "talla_col")
    @classmethod
    def limpiar_talla_campos(cls, value: Optional[str]):
        if value is not None:
            value = value.strip()
            if not value:
                raise ValueError("El campo de talla no puede estar vacío")
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
    def validar_cantidad(cls, value: Optional[int]):
        if value is not None and value < 0:
            raise ValueError("La cantidad no puede ser negativa")
        return value

    @field_validator("estado")
    @classmethod
    def validar_estado(cls, value: str):
        estados_validos = ["disponible", "agotado", "reservado"]
        value = value.strip().lower()
        if value not in estados_validos:
            raise ValueError(
                f"Estado no válido. Debe ser uno de: {', '.join(estados_validos)}"
            )
        return value


class InventarioCreate(InventarioBase):
    tallas: list[InventarioTallaCreate]

    @field_validator("tallas")
    @classmethod
    def validar_tallas_create(cls, value: list[InventarioTallaCreate]):
        if not value or len(value) < 1:
            raise ValueError("Debe haber al menos una talla para crear el producto")
        tallas_eur = [t.talla_eur for t in value]
        if len(tallas_eur) != len(set(tallas_eur)):
            raise ValueError(
                "No se permiten tallas EUR duplicadas en el mismo producto"
            )
        return value


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
    tallas: Optional[list[InventarioTallaCreate]] = None

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
                raise ValueError(
                    f"Estado no válido. Debe ser uno de: {', '.join(estados_validos)}"
                )
        return value

    @field_validator("tallas")
    @classmethod
    def validar_tallas_update(cls, value: Optional[list[InventarioTallaCreate]]):
        if value is not None:
            if len(value) < 1:
                raise ValueError("Debe haber al menos una talla para el producto")
            tallas_eur = [t.talla_eur for t in value]
            if len(tallas_eur) != len(set(tallas_eur)):
                raise ValueError(
                    "No se permiten tallas EUR duplicadas en el mismo producto"
                )
        return value


class InventarioResponse(InventarioBase):
    id: int
    fecha_registro: datetime
    tallas: list[InventarioTallaResponse] = []
    cantidad_total: int

    class Config:
        from_attributes = True


class EntradaTallaItem(BaseModel):
    talla_eur: str
    cantidad: int = Field(..., gt=0, description="Cantidad que ingresa, debe ser mayor a 0")
    costo_unitario: Decimal = Field(..., ge=0, description="Costo unitario real de compra")

    @field_validator("talla_eur")
    @classmethod
    def validar_talla(cls, val: str):
        v = val.strip()
        if v not in MAPPING_TALLAS:
            raise ValueError(f"Talla EUR '{v}' no válida. Permitidas: {', '.join(MAPPING_TALLAS.keys())}")
        return v


class EntradaStockCreate(BaseModel):
    fecha_ingreso: str = Field(..., description="Fecha de ingreso YYYY-MM-DD")
    items: list[EntradaTallaItem] = Field(..., min_length=1, description="Lista de tallas y cantidades que ingresan")
    observaciones: Optional[str] = None

    @field_validator("fecha_ingreso")
    @classmethod
    def validar_fecha(cls, val: str):
        v = val.strip()
        if not v:
            raise ValueError("fecha_ingreso es obligatoria")
        from datetime import datetime as dt
        try:
            dt.strptime(v, "%Y-%m-%d")
        except ValueError:
            raise ValueError("fecha_ingreso debe tener el formato YYYY-MM-DD")
        return v


class EntradaStockResponse(BaseModel):
    mensaje: str
    inventario_id: int
    lotes_creados: int
    total_unidades_ingresadas: int
    tallas_actualizadas: list[InventarioTallaResponse]

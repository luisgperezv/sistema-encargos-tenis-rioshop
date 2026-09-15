from pydantic import BaseModel, field_validator
from datetime import datetime, date
from typing import Optional


CATEGORIAS_GASTOS = [
    "Publicidad",
    "Arriendo",
    "Servicios",
    "Personal",
    "Medias",
    "Empaques",
    "Transporte",
    "Mantenimiento",
    "Software",
    "Impuestos",
    "Otros",
]

METODOS_PAGO_GASTO = [
    "Efectivo",
    "Transferencia",
    "Tarjeta Débito",
    "Nequi",
    "Otro",
]

# Variantes aceptadas para normalización
_METODOS_NORMALIZADOS = {
    "efectivo": "Efectivo",
    "transferencia": "Transferencia",
    "tarjeta debito": "Tarjeta Débito",
    "tarjeta débito": "Tarjeta Débito",
    "nequi": "Nequi",
    "otro": "Otro",
}

AYUDAS_CATEGORIA = {
    "Transporte": "Solo movilización general del negocio. No registrar aquí el flete de un encargo.",
    "Personal": "Solo comisiones o salarios generales. No registrar aquí el costo_despachador de un encargo específico.",
}


def _validar_fecha(v: str) -> str:
    """Valida formato YYYY-MM-DD y que no sea fecha futura."""
    v = v.strip()
    try:
        parsed = date.fromisoformat(v)
    except ValueError:
        raise ValueError("La fecha debe tener formato YYYY-MM-DD")
    if parsed > date.today():
        raise ValueError("La fecha del gasto no puede ser futura")
    if parsed < date(2020, 1, 1):
        raise ValueError("La fecha del gasto parece demasiado antigua (antes de 2020)")
    return v


class GastoCreate(BaseModel):
    fecha: str
    categoria: str
    descripcion: str
    valor: int
    metodo_pago: str
    observaciones: Optional[str] = None

    @field_validator("fecha")
    @classmethod
    def validar_fecha(cls, v: str) -> str:
        return _validar_fecha(v)

    @field_validator("categoria")
    @classmethod
    def validar_categoria(cls, v: str) -> str:
        v = v.strip()
        if v not in CATEGORIAS_GASTOS:
            raise ValueError(f"Categoría inválida. Opciones válidas: {CATEGORIAS_GASTOS}")
        return v

    @field_validator("descripcion")
    @classmethod
    def validar_descripcion(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 3:
            raise ValueError("La descripción debe tener al menos 3 caracteres")
        return v

    @field_validator("valor")
    @classmethod
    def validar_valor(cls, v: int) -> int:
        if v <= 0:
            raise ValueError("El valor del gasto debe ser mayor que 0")
        if v > 100_000_000:
            raise ValueError("El valor supera el límite permitido de $100.000.000 COP")
        return v

    @field_validator("metodo_pago")
    @classmethod
    def validar_metodo_pago(cls, v: str) -> str:
        v_clean = v.strip()
        v_lower = v_clean.lower()
        if v_lower in _METODOS_NORMALIZADOS:
            return _METODOS_NORMALIZADOS[v_lower]
        if v_clean in METODOS_PAGO_GASTO:
            return v_clean
        raise ValueError(f"Método de pago inválido. Opciones válidas: {METODOS_PAGO_GASTO}")

    @field_validator("observaciones")
    @classmethod
    def limpiar_observaciones(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            v = v.strip()
            return v if v else None
        return None


class GastoUpdate(GastoCreate):
    pass


class GastoResponse(BaseModel):
    id: int
    fecha: str
    categoria: str
    descripcion: str
    valor: int
    metodo_pago: str
    observaciones: Optional[str]
    fecha_registro: datetime

    class Config:
        from_attributes = True


class GastoResumenCategoria(BaseModel):
    categoria: str
    total: int
    cantidad: int


class GastoResumenResponse(BaseModel):
    fecha_desde: Optional[str]
    fecha_hasta: Optional[str]
    categoria: Optional[str]
    total_gastos: int
    cantidad_gastos: int
    por_categoria: list[GastoResumenCategoria]

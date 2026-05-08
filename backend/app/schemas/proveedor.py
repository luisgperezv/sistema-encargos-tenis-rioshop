from pydantic import BaseModel, field_validator


class ProveedorCreate(BaseModel):
    nombre: str
    telefono: str

    @field_validator("nombre")
    @classmethod
    def limpiar_nombre(cls, value: str):
        value = " ".join(value.strip().split())
        if len(value) < 2:
            raise ValueError("El nombre del proveedor es demasiado corto")
        return value

    @field_validator("telefono")
    @classmethod
    def limpiar_telefono(cls, value: str):
        value = value.strip()
        value = value.replace(" ", "").replace("-", "").replace("(", "").replace(")", "").replace("+", "")

        if value.startswith("57") and len(value) == 12:
            value = value[2:]

        if not value.isdigit():
            raise ValueError("El teléfono del proveedor debe contener solo números")

        if len(value) != 10:
            raise ValueError("El teléfono del proveedor debe tener exactamente 10 dígitos")

        return value

class ProveedorUpdate(BaseModel):
    nombre: str
    telefono: str

    @field_validator("nombre")
    @classmethod
    def limpiar_nombre(cls, value: str):
        value = " ".join(value.strip().split())
        if len(value) < 2:
            raise ValueError("El nombre del proveedor es demasiado corto")
        return value

    @field_validator("telefono")
    @classmethod
    def limpiar_telefono(cls, value: str):
        value = value.strip()
        value = value.replace(" ", "").replace("-", "").replace("(", "").replace(")", "").replace("+", "")

        if value.startswith("57") and len(value) == 12:
            value = value[2:]

        if not value.isdigit():
            raise ValueError("El teléfono del proveedor debe contener solo números")

        if len(value) != 10:
            raise ValueError("El teléfono del proveedor debe tener exactamente 10 dígitos")

        return value

class ProveedorResponse(BaseModel):
    id: int
    nombre: str
    telefono: str

    class Config:
        from_attributes = True
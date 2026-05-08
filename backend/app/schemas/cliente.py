from pydantic import BaseModel, field_validator


class ClienteCreate(BaseModel):
    nombre: str
    telefono: str

    @field_validator("nombre")
    @classmethod
    def limpiar_nombre(cls, value: str):
        value = " ".join(value.strip().split())

        if len(value) < 2:
            raise ValueError("El nombre es demasiado corto")

        return value

    @field_validator("telefono")
    @classmethod
    def limpiar_telefono(cls, value: str):
        value = value.strip()
        value = value.replace(" ", "")
        value = value.replace("-", "")
        value = value.replace("(", "")
        value = value.replace(")", "")
        value = value.replace("+", "")

        if value.startswith("57") and len(value) > 10:
            value = value[2:]

        if not value.isdigit():
            raise ValueError("El teléfono solo debe contener números")

        if len(value) < 10 or len(value) > 10:
            raise ValueError("El teléfono debe tener exactamente 10 dígitos")

        return value

class ClienteUpdate(BaseModel):
    nombre: str
    telefono: str

    @field_validator("nombre")
    @classmethod
    def limpiar_nombre(cls, value: str):
        value = " ".join(value.strip().split())

        if len(value) < 2:
            raise ValueError("El nombre es demasiado corto")

        return value

    @field_validator("telefono")
    @classmethod
    def limpiar_telefono(cls, value: str):
        value = value.strip()
        value = value.replace(" ", "")
        value = value.replace("-", "")
        value = value.replace("(", "")
        value = value.replace(")", "")
        value = value.replace("+", "")

        if value.startswith("57") and len(value) > 10:
            value = value[2:]

        if not value.isdigit():
            raise ValueError("El teléfono solo debe contener números")

        if len(value) != 10:
            raise ValueError("El teléfono debe tener exactamente 10 dígitos")

        return value

class ClienteResponse(BaseModel):
    id: int
    nombre: str
    telefono: str

    class Config:
        from_attributes = True
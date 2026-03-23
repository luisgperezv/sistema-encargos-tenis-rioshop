from pydantic import BaseModel

class ClienteCreate(BaseModel):
    nombre: str
    telefono: str

class ClienteResponse(BaseModel):
    id: int
    nombre: str
    telefono: str

    class Config:
        from_attributes = True
from pydantic import BaseModel, field_validator, model_validator


TALLAS_VALIDAS = {
    "35": ["36"],
    "36": ["37"],
    "37": ["38"],
    "38": ["39", "40"],
    "39": ["40", "41"],
    "40": ["42"],
    "41": ["43"],
    "42": ["44"],
    "43": ["45"],
}


class ClienteMiniResponse(BaseModel):
    id: int
    nombre: str
    telefono: str

    class Config:
        from_attributes = True


class EncargoCreate(BaseModel):
    cliente_id: int
    referencia: str
    talla_col: str
    talla_eur: str | None = None
    foto: str
    precio: float
    abono: float = 0
    fecha_entrega_estimada: str | None = None
    observaciones: str | None = None

    @field_validator("referencia")
    @classmethod
    def limpiar_referencia(cls, value: str):
        value = " ".join(value.strip().split())
        if len(value) < 2:
            raise ValueError("La referencia es demasiado corta")
        return value

    @field_validator("talla_col")
    @classmethod
    def limpiar_talla_col(cls, value: str):
        value = value.strip()
        if not value.isdigit():
            raise ValueError("La talla colombiana debe ser numérica")
        if value not in TALLAS_VALIDAS:
            raise ValueError("La talla colombiana no está permitida")
        return value

    @field_validator("talla_eur")
    @classmethod
    def limpiar_talla_eur(cls, value: str | None):
        if value is None:
            return None

        value = value.strip()

        if value == "":
            return None

        if not value.isdigit():
            raise ValueError("La talla europea debe ser numérica")

        return value

    @field_validator("observaciones")
    @classmethod
    def limpiar_observaciones(cls, value: str | None):
        if value is None:
            return value
        return " ".join(value.strip().split())

    @model_validator(mode="after")
    def validar_par_tallas(self):
        opciones_eur = TALLAS_VALIDAS[self.talla_col]

        if self.talla_eur is None:
            if len(opciones_eur) == 1:
                self.talla_eur = opciones_eur[0]
            else:
                raise ValueError(
                    f"Para la talla colombiana {self.talla_col}, debes elegir una talla EUR válida: {', '.join(opciones_eur)}"
                )
        else:
            if self.talla_eur not in opciones_eur:
                raise ValueError(
                    f"La combinación no es válida. Para talla COL {self.talla_col}, las opciones EUR válidas son: {', '.join(opciones_eur)}"
                )

        return self


class EncargoUpdate(BaseModel):
    referencia: str
    talla_col: str
    talla_eur: str | None = None
    foto: str
    precio: float
    fecha_entrega_estimada: str | None = None
    observaciones: str | None = None

    @field_validator("referencia")
    @classmethod
    def limpiar_referencia(cls, value: str):
        value = " ".join(value.strip().split())
        if len(value) < 2:
            raise ValueError("La referencia es demasiado corta")
        return value

    @field_validator("talla_col")
    @classmethod
    def limpiar_talla_col(cls, value: str):
        value = value.strip()
        if not value.isdigit():
            raise ValueError("La talla colombiana debe ser numérica")
        if value not in TALLAS_VALIDAS:
            raise ValueError("La talla colombiana no está permitida")
        return value

    @field_validator("talla_eur")
    @classmethod
    def limpiar_talla_eur(cls, value: str | None):
        if value is None:
            return None

        value = value.strip()

        if value == "":
            return None

        if not value.isdigit():
            raise ValueError("La talla europea debe ser numérica")

        return value

    @field_validator("observaciones")
    @classmethod
    def limpiar_observaciones(cls, value: str | None):
        if value is None:
            return value
        return " ".join(value.strip().split())

    @model_validator(mode="after")
    def validar_par_tallas(self):
        opciones_eur = TALLAS_VALIDAS[self.talla_col]

        if self.talla_eur is None:
            if len(opciones_eur) == 1:
                self.talla_eur = opciones_eur[0]
            else:
                raise ValueError(
                    f"Para la talla colombiana {self.talla_col}, debes elegir una talla EUR válida: {', '.join(opciones_eur)}"
                )
        else:
            if self.talla_eur not in opciones_eur:
                raise ValueError(
                    f"La combinación no es válida. Para talla COL {self.talla_col}, las opciones EUR válidas son: {', '.join(opciones_eur)}"
                )

        return self


class EncargoEstadoUpdate(BaseModel):
    estado: str


class EncargoAbonoUpdate(BaseModel):
    abono: float


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
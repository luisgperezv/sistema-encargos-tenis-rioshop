from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import os
from app.core.security import create_access_token

router = APIRouter()


class LoginRequest(BaseModel):
    username: str
    password: str


@router.post("/login")
def login(data: LoginRequest):
    admin_user = os.getenv("ADMIN_USER")
    admin_password = os.getenv("ADMIN_PASSWORD")

    if not admin_user or not admin_password:
        raise HTTPException(
            status_code=500,
            detail="ADMIN_USER o ADMIN_PASSWORD no están configurados"
        )

    if data.username != admin_user or data.password != admin_password:
        raise HTTPException(status_code=401, detail="Credenciales incorrectas")

    token = create_access_token({"sub": data.username})

    return {
        "access_token": token,
        "token_type": "bearer"
    }
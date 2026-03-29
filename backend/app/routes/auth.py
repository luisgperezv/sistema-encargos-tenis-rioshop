from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import os
from dotenv import load_dotenv
from app.core.security import create_access_token

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
ENV_PATH = os.path.join(BASE_DIR, ".env")
load_dotenv(ENV_PATH)

router = APIRouter()

ADMIN_USER = os.getenv("ADMIN_USER")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD")


class LoginRequest(BaseModel):
    username: str
    password: str


@router.post("/login")
def login(data: LoginRequest):
    if data.username != ADMIN_USER or data.password != ADMIN_PASSWORD:
        raise HTTPException(status_code=401, detail="Credenciales incorrectas")

    token = create_access_token({"sub": data.username})

    return {
        "access_token": token,
        "token_type": "bearer"
    }
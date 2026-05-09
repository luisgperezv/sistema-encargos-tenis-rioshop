from fastapi import FastAPI, Request, Query
from app.database import engine, Base

from app.models import cliente
from app.models import encargo
from app.models import proveedor

from app.routes import cliente as cliente_router
from app.routes import encargo as encargo_router
from app.routes import proveedor as proveedor_router

from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from app.routes import auth as auth_router
import os

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Sistema de Encargos Tenis Rio Shop")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "https://merry-appreciation-production-135b.up.railway.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
UPLOADS_DIR = os.path.join(BASE_DIR, "uploads")

app.mount("/uploads", StaticFiles(directory=UPLOADS_DIR), name="uploads")

app.include_router(cliente_router.router)
app.include_router(encargo_router.router)
app.include_router(proveedor_router.router)
app.include_router(auth_router.router)

@app.get("/")
def root():
    return {"mensaje": "API funcionando correctamente"}


VERIFY_TOKEN = "tenisrio123"

@app.get("/webhook")
def verificar_webhook(
    hub_mode: str = Query(None, alias="hub.mode"),
    hub_challenge: str = Query(None, alias="hub.challenge"),
    hub_verify_token: str = Query(None, alias="hub.verify_token")
):
    if hub_mode == "subscribe" and hub_verify_token == VERIFY_TOKEN:
        return int(hub_challenge)

    return {"error": "Token incorrecto"}


@app.post("/webhook")
async def recibir_webhook(request: Request):
    data = await request.json()
    print("WEBHOOK_STATUS:", data)
    return {"status": "ok"}
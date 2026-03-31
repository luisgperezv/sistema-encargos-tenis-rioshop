from fastapi import FastAPI
from app.database import engine, Base

from app.models import cliente
from app.models import encargo
from app.models import proveedor

from app.routes import cliente as cliente_router
from app.routes import encargo as encargo_router
from app.routes import proveedor as proveedor_router
from app.models import proveedor

from fastapi.staticfiles import StaticFiles
from app.routes import auth as auth_router
import os

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Sistema de Encargos Tenis Rio Shop")
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
from fastapi import FastAPI
from app.database import engine, Base

from app.models import cliente
from app.models import encargo

from app.routes import cliente as cliente_router
from app.routes import encargo as encargo_router

from fastapi.staticfiles import StaticFiles
import os

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Sistema de Encargos Tenis Rio Shop")
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
UPLOADS_DIR = os.path.join(BASE_DIR, "uploads")

app.mount("/uploads", StaticFiles(directory=UPLOADS_DIR), name="uploads")

app.include_router(cliente_router.router)
app.include_router(encargo_router.router)

@app.get("/")
def root():
    return {"mensaje": "API funcionando correctamente"}
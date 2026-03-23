from fastapi import FastAPI
from app.database import engine
from app.models import cliente as cliente_model
from app.routes import cliente as cliente_router

cliente_model.Base.metadata.create_all(bind=engine)

app = FastAPI()

app.include_router(cliente_router.router)

@app.get("/")
def root():
    return {"mensaje": "API funcionando correctamente"}
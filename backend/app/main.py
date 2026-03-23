from fastapi import FastAPI
from app.database import engine
from app.models import cliente

cliente.Base.metadata.create_all(bind=engine)
app = FastAPI()

@app.get("/")
def root():
    return {"mensaje": "API funcionando correctamente"}
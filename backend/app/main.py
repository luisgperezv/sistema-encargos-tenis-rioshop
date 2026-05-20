from fastapi import FastAPI, Request, Query
from app.database import engine, Base

from app.models import cliente
from app.models import encargo
from app.models import proveedor
from app.models import mensaje_proveedor

from app.routes import cliente as cliente_router
from app.routes import encargo as encargo_router
from app.routes import proveedor as proveedor_router
from app.routes import mensaje_proveedor as mensaje_proveedor_router

from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from app.routes import auth as auth_router
import os

Base.metadata.create_all(bind=engine)

def ejecutar_migraciones_ligeras():
    """
    Agrega de manera segura y defensiva la columna media_url a mensajes_proveedores
    si no existe. No bloquea el arranque del servidor si ocurre algún error.
    """
    from sqlalchemy import text
    from app.database import SessionLocal
    import logging
    
    print("[MIGRACIÓN] Iniciando verificación de base de datos...", flush=True)
    db = SessionLocal()
    try:
        db.execute(text("SELECT media_url FROM mensajes_proveedores LIMIT 1"))
        print("[MIGRACIÓN] La columna media_url ya existe en la tabla mensajes_proveedores.", flush=True)
    except Exception:
        db.rollback()
        print("[MIGRACIÓN] La columna media_url no existe. Intentando agregarla...", flush=True)
        try:
            db.execute(text("ALTER TABLE mensajes_proveedores ADD COLUMN media_url VARCHAR"))
            db.commit()
            print("[MIGRACIÓN] Columna media_url añadida exitosamente.", flush=True)
        except Exception as alter_err:
            db.rollback()
            logging.warning(
                f"[MIGRACIÓN WARNING] No se pudo agregar la columna media_url automáticamente: {str(alter_err)}. "
                "Es posible que deba agregarse manualmente."
            )
    finally:
        db.close()


ejecutar_migraciones_ligeras()


app = FastAPI(title="Sistema de Encargos Tenis Rio Shop")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "https://merry-appreciation-production-135b.up.railway.app",
        "https://encargos.tenisrioshop.com",
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
app.include_router(mensaje_proveedor_router.router)
app.include_router(auth_router.router)


@app.get("/")
def root():
    return {"mensaje": "API funcionando correctamente"}


VERIFY_TOKEN = "tenisrio123"


@app.get("/webhook")
def verificar_webhook(
    hub_mode: str = Query(None, alias="hub.mode"),
    hub_challenge: str = Query(None, alias="hub.challenge"),
    hub_verify_token: str = Query(None, alias="hub.verify_token"),
):
    if hub_mode == "subscribe" and hub_verify_token == VERIFY_TOKEN:
        return int(hub_challenge)

    return {"error": "Token incorrecto"}


@app.post("/webhook")
async def recibir_webhook(request: Request):
    data = await request.json()
    print("WEBHOOK_STATUS:", data)
    
    try:
        if "entry" in data and len(data["entry"]) > 0:
            for entry in data["entry"]:
                if "changes" in entry and len(entry["changes"]) > 0:
                    for change in entry["changes"]:
                        value = change.get("value", {})
                        
                        # Solo procesamos si hay mensajes entrantes, ignorando 'statuses' para evitar loops
                        if "messages" in value and len(value["messages"]) > 0:
                            from app.database import SessionLocal
                            from app.models.proveedor import Proveedor
                            from app.models.mensaje_proveedor import MensajeProveedor
                            from datetime import datetime
                            
                            db = SessionLocal()
                            try:
                                for message in value["messages"]:
                                    emisor = message.get("from")
                                    
                                    if emisor:
                                        from app.services.whatsapp import normalizar_numero_whatsapp
                                        emisor_normalizado = normalizar_numero_whatsapp(emisor)
                                        print(f"[WEBHOOK] Recibido de: {emisor} | Normalizado: {emisor_normalizado}")
                                        
                                        proveedores = db.query(Proveedor).all()
                                        proveedor_encontrado = None
                                        for p in proveedores:
                                            if normalizar_numero_whatsapp(p.telefono) == emisor_normalizado:
                                                proveedor_encontrado = p
                                                break
                                                
                                        if proveedor_encontrado:
                                            print(f"[WEBHOOK] Proveedor encontrado: ID {proveedor_encontrado.id} - {proveedor_encontrado.nombre}")
                                            msg_type = message.get("type", "unknown")
                                            contenido = ""
                                            media_url = None
                                            
                                            if msg_type == "text":
                                                contenido = message.get("text", {}).get("body", "")
                                            else:
                                                contenido_obj = message.get(msg_type, {})
                                                if isinstance(contenido_obj, dict) and "caption" in contenido_obj:
                                                    contenido = contenido_obj.get("caption", "")
                                                else:
                                                    contenido = f"[Mensaje {msg_type}]"
                                                
                                                # Si es de tipo imagen, intentamos descargarla y subirla a Cloudinary
                                                if msg_type == "image" and isinstance(contenido_obj, dict) and "id" in contenido_obj:
                                                    from app.services.whatsapp import descargar_y_subir_media_whatsapp
                                                    media_id = contenido_obj["id"]
                                                    media_url = descargar_y_subir_media_whatsapp(media_id)
                                                    if not media_url:
                                                        contenido = "[Imagen recibida, pero no se pudo descargar]"
                                            
                                            contactos = value.get("contacts", [])
                                            nombre_perfil = contactos[0].get("profile", {}).get("name") if contactos else None
                                            whatsapp_msg_id = message.get("id")
                                            
                                            nuevo_mensaje = MensajeProveedor(
                                                proveedor_id=proveedor_encontrado.id,
                                                telefono=proveedor_encontrado.telefono, # Guardar el teléfono como está en la DB
                                                nombre_perfil=nombre_perfil,
                                                direccion="entrante",
                                                tipo=msg_type,
                                                contenido=contenido,
                                                media_url=media_url,
                                                whatsapp_message_id=whatsapp_msg_id,
                                                fecha_creacion=datetime.utcnow()
                                            )
                                            db.add(nuevo_mensaje)
                                            db.commit()
                                            print(f"[WEBHOOK] Mensaje de proveedor {proveedor_encontrado.telefono} guardado.")
                                        else:
                                            print(f"[WEBHOOK] No se encontró proveedor para {emisor_normalizado}. Enviando auto-respuesta.")
                                            texto_respuesta = (
                                                "Hola 👋 Gracias por escribirnos.\n\n"
                                                "Este número se usa únicamente para notificaciones automáticas de tus encargos.\n\n"
                                                "Para atención personalizada, dudas, cambios o soporte, escríbenos a nuestro WhatsApp principal:\n\n"
                                                "https://wa.me/573242697263\n\n"
                                                "Con gusto te atendemos por ese canal."
                                            )
                                            
                                            from app.services.whatsapp import enviar_mensaje_texto
                                            enviar_mensaje_texto(emisor, texto_respuesta)
                                            print(f"Respuesta automática enviada a {emisor}")
                            finally:
                                db.close()
    except Exception as e:
        print("Error procesando webhook:", str(e))
        
    return {"status": "ok"}

from fastapi import FastAPI, Request, Query
from app.database import engine, Base

from app.models import cliente
from app.models import encargo
from app.models import proveedor
from app.models import mensaje_proveedor
from app.models import venta
from app.models import inventario
from app.models import inventario_talla

from app.routes import cliente as cliente_router
from app.routes import encargo as encargo_router
from app.routes import proveedor as proveedor_router
from app.routes import mensaje_proveedor as mensaje_proveedor_router
from app.routes import venta as venta_router
from app.routes import inventario as inventario_router

from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from app.routes import auth as auth_router
import os

Base.metadata.create_all(bind=engine)

def ejecutar_migraciones_ligeras():
    """
    Agrega de manera segura y defensiva las nuevas columnas a las tablas mensajes_proveedores
    y encargos si no existen. No bloquea el arranque del servidor si ocurre algún error.
    """
    from sqlalchemy import text
    from app.database import SessionLocal
    import logging
    
    print("[MIGRACIÓN] Iniciando verificación de base de datos...", flush=True)
    db = SessionLocal()
    
    # 1. Verificar/agregar columnas en mensajes_proveedores
    columnas_mensajes = {
        "media_url": "VARCHAR",
        "reply_to_whatsapp_message_id": "VARCHAR",
        "reply_to_text": "TEXT",
        "reply_to_media_url": "VARCHAR"
    }
    
    for col, col_type in columnas_mensajes.items():
        try:
            db.execute(text(f"SELECT {col} FROM mensajes_proveedores LIMIT 1"))
            print(f"[MIGRACIÓN] La columna {col} ya existe en la tabla mensajes_proveedores.", flush=True)
        except Exception:
            db.rollback()
            print(f"[MIGRACIÓN] La columna {col} no existe. Intentando agregarla...", flush=True)
            try:
                db.execute(text(f"ALTER TABLE mensajes_proveedores ADD COLUMN {col} {col_type}"))
                db.commit()
                print(f"[MIGRACIÓN] Columna {col} añadida exitosamente.", flush=True)
            except Exception as alter_err:
                db.rollback()
                logging.warning(
                    f"[MIGRACIÓN WARNING] No se pudo agregar la columna {col} automáticamente: {str(alter_err)}. "
                    "Es posible que deba agregarse manualmente."
                )
                
    # 2. Verificar/agregar columnas en encargos
    columnas_encargos = {
        "costo_base": "DOUBLE PRECISION",
        "costo_envio": "DOUBLE PRECISION",
        "costo_despachador": "DOUBLE PRECISION",
        "costo_total": "DOUBLE PRECISION",
        "utilidad_estimada": "DOUBLE PRECISION",
        "fecha_despacho": "VARCHAR",
        "fecha_entregado": "VARCHAR",
        "motivo_cancelacion": "VARCHAR",
        "fecha_cancelacion": "VARCHAR",
        "metodo_pago": "VARCHAR"
    }
    
    for col, col_type in columnas_encargos.items():
        try:
            db.execute(text(f"SELECT {col} FROM encargos LIMIT 1"))
            print(f"[MIGRACIÓN] La columna {col} ya existe en la tabla encargos.", flush=True)
        except Exception:
            db.rollback()
            print(f"[MIGRACIÓN] La columna {col} no existe en la tabla encargos. Intentando agregarla...", flush=True)
            try:
                db.execute(text(f"ALTER TABLE encargos ADD COLUMN {col} {col_type}"))
                db.commit()
                print(f"[MIGRACIÓN] Columna {col} añadida exitosamente a la tabla encargos.", flush=True)
            except Exception as alter_err:
                db.rollback()
                logging.warning(
                    f"[MIGRACIÓN WARNING] No se pudo agregar la columna {col} a la tabla encargos automáticamente: {str(alter_err)}. "
                    "Es posible que deba agregarse manualmente."
                )

    # 3. Verificar/crear tabla ventas y columnas nuevas
    try:
        db.execute(text("SELECT id FROM ventas LIMIT 1"))
        print("[MIGRACIÓN] La tabla ventas ya existe.", flush=True)

        # Intentar poner las columnas existentes como NULLABLE (para Postgres/Railway)
        columnas_not_null_a_null = [
            "cliente_id", "cliente_nombre", "cliente_telefono", "referencia", "talla_eur",
            "talla_col", "precio_venta", "costo_base", "costo_envio", "costo_despachador",
            "costo_total", "utilidad", "metodo_pago", "fecha_venta"
        ]
        for col in columnas_not_null_a_null:
            try:
                db.execute(text(f"ALTER TABLE ventas ALTER COLUMN {col} DROP NOT NULL"))
                db.commit()
            except Exception:
                db.rollback()

        # Agregar nuevas columnas si no existen
        columnas_nuevas_ventas = {
            "origen": "VARCHAR NOT NULL DEFAULT 'encargo'",
            "inventario_id": "INTEGER",
            "inventario_talla_id": "INTEGER",
            "marca": "VARCHAR",
            "cantidad": "INTEGER DEFAULT 1",
            "precio_unitario": "DOUBLE PRECISION",
            "subtotal": "DOUBLE PRECISION",
            "observaciones": "TEXT"
        }
        for col, col_type in columnas_nuevas_ventas.items():
            try:
                db.execute(text(f"SELECT {col} FROM ventas LIMIT 1"))
            except Exception:
                db.rollback()
                print(f"[MIGRACIÓN] La columna {col} no existe en la tabla ventas. Intentando agregarla...", flush=True)
                try:
                    db.execute(text(f"ALTER TABLE ventas ADD COLUMN {col} {col_type}"))
                    db.commit()
                    print(f"[MIGRACIÓN] Columna {col} añadida exitosamente a la tabla ventas.", flush=True)
                except Exception as col_err:
                    db.rollback()
                    logging.warning(
                        f"[MIGRACIÓN WARNING] No se pudo agregar la columna {col} a la tabla ventas: {str(col_err)}."
                    )
    except Exception:
        db.rollback()
        print("[MIGRACIÓN] La tabla ventas no existe. Creándola con sus restricciones...", flush=True)
        try:
            Base.metadata.create_all(bind=engine)
            print("[MIGRACIÓN] Tabla ventas y sus restricciones creadas correctamente.", flush=True)
        except Exception as create_err:
            logging.warning(
                f"[MIGRACIÓN WARNING] No se pudo crear la tabla ventas automáticamente: {str(create_err)}."
            )

    # 4. Verificar/crear tabla inventario
    try:
        db.execute(text("SELECT id FROM inventario LIMIT 1"))
        print("[MIGRACIÓN] La tabla inventario ya existe.", flush=True)
    except Exception:
        db.rollback()
        print("[MIGRACIÓN] La tabla inventario no existe. Creándola...", flush=True)
        try:
            Base.metadata.create_all(bind=engine)
            print("[MIGRACIÓN] Tabla inventario creada correctamente.", flush=True)
        except Exception as create_err:
            logging.warning(
                f"[MIGRACIÓN WARNING] No se pudo crear la tabla inventario automáticamente: {str(create_err)}."
            )
            
    # 5. Verificar/crear tabla inventario_tallas y realizar backfill
    try:
        db.execute(text("SELECT id FROM inventario_tallas LIMIT 1"))
        print("[MIGRACIÓN] La tabla inventario_tallas ya existe.", flush=True)
    except Exception:
        db.rollback()
        print("[MIGRACIÓN] La tabla inventario_tallas no existe. Creándola...", flush=True)
        try:
            Base.metadata.create_all(bind=engine)
            print("[MIGRACIÓN] Tabla inventario_tallas creada correctamente.", flush=True)
        except Exception as create_err:
            logging.warning(
                f"[MIGRACIÓN WARNING] No se pudo crear la tabla inventario_tallas automáticamente: {str(create_err)}."
            )

    # 6. Verificar/crear columnas de normalización para marca y referencia en inventario (antes de hacer queries en Inventario)
    columnas_inventario = {
        "marca_normalizada": "VARCHAR",
        "referencia_normalizada": "VARCHAR"
    }
    
    for col, col_type in columnas_inventario.items():
        try:
            db.execute(text(f"SELECT {col} FROM inventario LIMIT 1"))
            print(f"[MIGRACIÓN] La columna {col} ya existe en la tabla inventario.", flush=True)
        except Exception:
            db.rollback()
            print(f"[MIGRACIÓN] La columna {col} no existe. Intentando agregarla...", flush=True)
            try:
                db.execute(text(f"ALTER TABLE inventario ADD COLUMN {col} {col_type}"))
                db.commit()
                print(f"[MIGRACIÓN] Columna {col} añadida exitosamente.", flush=True)
            except Exception as alter_err:
                db.rollback()
                logging.warning(
                    f"[MIGRACIÓN WARNING] No se pudo agregar la columna {col} automáticamente: {str(alter_err)}."
                )

    # 7. Backfill para productos antiguos de inventario
    try:
        from app.models.inventario import Inventario
        from app.models.inventario_talla import InventarioTalla
        
        productos = db.query(Inventario).all()
        migrados = 0
        for p in productos:
            # Si el producto no tiene ninguna talla en inventario_tallas
            tallas_existentes = db.query(InventarioTalla).filter(InventarioTalla.inventario_id == p.id).first()
            if not tallas_existentes:
                t_eur = p.talla_eur or "38"
                t_col = p.talla_col or "36"
                cant = p.cantidad if p.cantidad is not None else 0
                
                nueva_talla = InventarioTalla(
                    inventario_id=p.id,
                    talla_eur=t_eur,
                    talla_col=t_col,
                    cantidad=cant
                )
                db.add(nueva_talla)
                migrados += 1
        if migrados > 0:
            db.commit()
            print(f"[MIGRACIÓN] Se crearon automáticamente {migrados} tallas para productos antiguos.", flush=True)
        else:
            print("[MIGRACIÓN] No se requirió backfill de tallas.", flush=True)
    except Exception as backfill_err:
        db.rollback()
        logging.warning(f"[MIGRACIÓN WARNING] Error en el backfill de inventario_tallas: {str(backfill_err)}")

    # 7. Realizar backfill de marca_normalizada y referencia_normalizada para registros antiguos
    try:
        from app.models.inventario import Inventario
        from app.services.utils import normalizar_texto
        from sqlalchemy import or_

        productos_sin_norm = db.query(Inventario).filter(
            or_(
                Inventario.marca_normalizada == None,
                Inventario.referencia_normalizada == None
            )
        ).all()
        
        if productos_sin_norm:
            for p in productos_sin_norm:
                if p.marca_normalizada is None:
                    p.marca_normalizada = normalizar_texto(p.marca)
                if p.referencia_normalizada is None:
                    p.referencia_normalizada = normalizar_texto(p.referencia)
            db.commit()
            print(f"[MIGRACIÓN] Se normalizaron marca/referencia para {len(productos_sin_norm)} productos.", flush=True)
    except Exception as norm_err:
        db.rollback()
        logging.warning(f"[MIGRACIÓN WARNING] Error en backfill de normalización: {str(norm_err)}")

    # 8. Migración de etiquetas de tallas viejas a las nuevas en la DB (Verificando primero existencia de columnas)
    try:
        from app.models.inventario import Inventario
        from app.models.inventario_talla import InventarioTalla

        # Mapeo de tallas viejas a nuevas
        rename_map = {
            "40 dama": "40D",
            "40 hombre": "40H",
            "41 dama": "41D",
            "41 hombre": "41H"
        }

        # 8a. Verificar y migrar en inventario_tallas (columna talla_eur)
        tallas_col_exists = False
        try:
            db.execute(text("SELECT talla_eur FROM inventario_tallas LIMIT 1"))
            tallas_col_exists = True
        except Exception:
            db.rollback()

        if tallas_col_exists:
            tallas_a_migrar = db.query(InventarioTalla).filter(
                InventarioTalla.talla_eur.in_(list(rename_map.keys()))
            ).all()
            if tallas_a_migrar:
                for t in tallas_a_migrar:
                    t.talla_eur = rename_map[t.talla_eur]
                db.commit()
                print(f"[MIGRACIÓN] Se actualizaron {len(tallas_a_migrar)} registros en inventario_tallas.", flush=True)

        # 8b. Verificar y migrar en inventario (columna talla_eur)
        inventario_col_exists = False
        try:
            db.execute(text("SELECT talla_eur FROM inventario LIMIT 1"))
            inventario_col_exists = True
        except Exception:
            db.rollback()

        if inventario_col_exists:
            productos_a_migrar = db.query(Inventario).filter(
                Inventario.talla_eur.in_(list(rename_map.keys()))
            ).all()
            if productos_a_migrar:
                for p in productos_a_migrar:
                    p.talla_eur = rename_map[p.talla_eur]
                db.commit()
                print(f"[MIGRACIÓN] Se actualizaron {len(productos_a_migrar)} registros en inventario.", flush=True)
    except Exception as label_err:
        db.rollback()
        logging.warning(f"[MIGRACIÓN WARNING] Error migrando etiquetas de tallas: {str(label_err)}")
                
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
app.include_router(venta_router.router)
app.include_router(inventario_router.router)


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
                                            
                                            context_id = message.get("context", {}).get("id")
                                            reply_to_whatsapp_message_id = None
                                            reply_to_text = None
                                            reply_to_media_url = None
                                            
                                            if context_id:
                                                print(f"[WEBHOOK] Mensaje entrante tiene reply context: {context_id}")
                                                original_msg = db.query(MensajeProveedor).filter(
                                                    MensajeProveedor.whatsapp_message_id == context_id
                                                ).first()
                                                if original_msg:
                                                    print(f"[WEBHOOK] Mensaje original encontrado: {original_msg.id}")
                                                    reply_to_whatsapp_message_id = context_id
                                                    reply_to_text = original_msg.contenido
                                                    reply_to_media_url = original_msg.media_url
                                                else:
                                                    print(f"[WEBHOOK] Mensaje original NO encontrado para context_id {context_id}")
                                                    reply_to_whatsapp_message_id = context_id
                                            
                                            nuevo_mensaje = MensajeProveedor(
                                                proveedor_id=proveedor_encontrado.id,
                                                telefono=proveedor_encontrado.telefono, # Guardar el teléfono como está en la DB
                                                nombre_perfil=nombre_perfil,
                                                direccion="entrante",
                                                tipo=msg_type,
                                                contenido=contenido,
                                                media_url=media_url,
                                                whatsapp_message_id=whatsapp_msg_id,
                                                reply_to_whatsapp_message_id=reply_to_whatsapp_message_id,
                                                reply_to_text=reply_to_text,
                                                reply_to_media_url=reply_to_media_url,
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

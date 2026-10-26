from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from pydantic import BaseModel
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import or_, String
import shutil
import os
import uuid
import cloudinary
import cloudinary.uploader

from app.core.security import get_current_user
from app.services.whatsapp import (
    enviar_template_confirmacion_encargo,
    enviar_template_confirmacion_encargo_foto,
    enviar_template_encargo_en_local,
    enviar_template_proveedor_encargo,
    enviar_template_proveedor_foto,
    validar_y_normalizar_telefono,
)
from app.services.utils import formatear_pesos
from app.services.ventas import crear_venta_desde_encargo_si_no_existe
from app.services.notificaciones_whatsapp import (
    registrar_resultado_envio,
    envio_reciente_en_vuelo,
    validar_respuesta_meta_wamid,
    consultar_envio_incierto_reciente,
)
from app.core.config import settings

cloudinary.config(
    cloud_name=settings.CLOUDINARY_CLOUD_NAME,
    api_key=settings.CLOUDINARY_API_KEY,
    api_secret=settings.CLOUDINARY_API_SECRET,
    secure=True,
)

from datetime import date, datetime, timezone, timedelta
from app.database import get_db
from app.models.encargo import Encargo
from app.models.cliente import Cliente
from app.models.proveedor import Proveedor
from app.models.mensaje_proveedor import MensajeProveedor
from app.models.venta import Venta
from app.schemas.encargo import (
    EncargoCreate,
    EncargoResponse,
    EncargoEstadoUpdate,
    EncargoAbonoUpdate,
    EncargoUpdate,
    EncargoCostosUpdate,
)

router = APIRouter()

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
UPLOADS_DIR = os.path.join(BASE_DIR, "uploads")

ESTADOS_VALIDOS = [
    "pendiente",
    "despachado",
    "en_local",
    "entregado",
    "cancelado",
]


def validar_finanzas(precio: float, abono: float):
    if precio <= 0:
        raise HTTPException(status_code=400, detail="El precio debe ser mayor a 0")

    if abono < 0:
        raise HTTPException(status_code=400, detail="El abono no puede ser negativo")

    if abono > precio:
        raise HTTPException(
            status_code=400, detail="El abono no puede ser mayor que el precio"
        )

    saldo = precio - abono

    if saldo < 0:
        raise HTTPException(status_code=400, detail="El saldo no puede ser negativo")

    return saldo


@router.post("/upload")
def subir_imagen(file: UploadFile = File(...)):
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="El archivo debe ser una imagen")

    extension = os.path.splitext(file.filename)[1].lower()

    if extension not in [".jpg", ".jpeg", ".png", ".webp"]:
        raise HTTPException(status_code=400, detail="Formato de imagen no permitido")

    if (
        not settings.CLOUDINARY_CLOUD_NAME
        or not settings.CLOUDINARY_API_KEY
        or not settings.CLOUDINARY_API_SECRET
    ):
        raise HTTPException(
            status_code=500, detail="Cloudinary no está configurado correctamente"
        )

    try:
        resultado = cloudinary.uploader.upload(
            file.file,
            folder="tenisrioshop/encargos",
            resource_type="image",
            public_id=f"encargo_{uuid.uuid4().hex[:8]}",
            overwrite=False,
        )

        return {
            "mensaje": "Imagen subida correctamente",
            "ruta": resultado["secure_url"],
        }

    except Exception as e:
        print("Error subiendo imagen a Cloudinary:", e)
        raise HTTPException(
            status_code=500, detail="Error subiendo imagen a Cloudinary"
        )


@router.post("/encargos", response_model=EncargoResponse)
def crear_encargo(
    encargo: EncargoCreate,
    db: Session = Depends(get_db),
    current_user: str = Depends(get_current_user),
):
    # 1. VERIFICAR CLIENTE
    cliente = db.query(Cliente).filter(Cliente.id == encargo.cliente_id).first()
    if not cliente:
        raise HTTPException(status_code=404, detail="El cliente especificado no existe.")

    if not cliente.nombre or not cliente.nombre.strip():
        raise HTTPException(
            status_code=400,
            detail="El cliente seleccionado no tiene un nombre válido registrado."
        )

    if not cliente.telefono or not cliente.telefono.strip():
        raise HTTPException(
            status_code=400,
            detail="El cliente seleccionado no tiene un número de teléfono registrado."
        )

    telefono_cliente_norm = validar_y_normalizar_telefono(cliente.telefono)
    if not telefono_cliente_norm:
        raise HTTPException(
            status_code=400,
            detail="El número de teléfono del cliente no es un número de WhatsApp válido (debe contener entre 10 y 15 dígitos)."
        )

    # 2. VERIFICAR PROVEEDOR
    if not encargo.proveedor_id or encargo.proveedor_id <= 0:
        raise HTTPException(status_code=400, detail="El proveedor es obligatorio.")

    proveedor = (
        db.query(Proveedor).filter(Proveedor.id == encargo.proveedor_id).first()
    )
    if not proveedor:
        raise HTTPException(status_code=404, detail="El proveedor especificado no existe.")

    if not proveedor.nombre or not proveedor.nombre.strip():
        raise HTTPException(
            status_code=400,
            detail="El proveedor seleccionado no tiene un nombre válido registrado."
        )

    if not proveedor.telefono or not proveedor.telefono.strip():
        raise HTTPException(
            status_code=400,
            detail="El proveedor seleccionado no tiene un número de teléfono registrado."
        )

    telefono_proveedor_norm = validar_y_normalizar_telefono(proveedor.telefono)
    if not telefono_proveedor_norm:
        raise HTTPException(
            status_code=400,
            detail="El número de teléfono del proveedor no es un número de WhatsApp válido (debe contener entre 10 y 15 dígitos)."
        )

    # 3. VERIFICAR DATOS REQUERIDOS DEL ENCARGO
    if not encargo.foto or not encargo.foto.strip():
        raise HTTPException(status_code=400, detail="La foto del producto es obligatoria.")

    if not encargo.fecha_entrega_estimada or not encargo.fecha_entrega_estimada.strip():
        raise HTTPException(status_code=400, detail="La fecha estimada de entrega es obligatoria.")

    saldo = validar_finanzas(encargo.precio, encargo.abono)

    # 4. CREAR ENCARGO EN BASE DE DATOS
    nuevo_encargo = Encargo(
        cliente_id=encargo.cliente_id,
        proveedor_id=encargo.proveedor_id,
        referencia=encargo.referencia,
        talla_eur=encargo.talla_eur,
        talla_col=encargo.talla_col,
        foto=encargo.foto,
        precio=encargo.precio,
        abono=encargo.abono,
        saldo=saldo,
        estado="pendiente",
        fecha_creacion=str(date.today()),
        fecha_entrega_estimada=encargo.fecha_entrega_estimada.strip(),
        observaciones=encargo.observaciones,
    )

    nuevo_encargo.cliente = cliente
    nuevo_encargo.proveedor = proveedor

    db.add(nuevo_encargo)
    db.commit()
    db.refresh(nuevo_encargo)

    # 5. INTENTAR NOTIFICAR AL CLIENTE VÍA WHATSAPP
    # La foto original (nuevo_encargo.foto) no se modifica; el servicio de WhatsApp
    # genera y verifica una versión optimizada derivada de Cloudinary.
    image_url = nuevo_encargo.foto
    respuesta_whatsapp_cliente = None
    try:
        if image_url:
            respuesta_whatsapp_cliente = enviar_template_confirmacion_encargo_foto(
                numero=telefono_cliente_norm,
                image_url=image_url,
                nombre=cliente.nombre,
                referencia=nuevo_encargo.referencia,
                talla_col=nuevo_encargo.talla_col,
                talla_eur=nuevo_encargo.talla_eur,
                precio=formatear_pesos(nuevo_encargo.precio),
                abono=formatear_pesos(nuevo_encargo.abono),
                saldo=formatear_pesos(nuevo_encargo.saldo),
                fecha_estimada=nuevo_encargo.fecha_entrega_estimada,
            )
        else:
            respuesta_whatsapp_cliente = enviar_template_confirmacion_encargo(
                numero=telefono_cliente_norm,
                nombre=cliente.nombre,
                referencia=nuevo_encargo.referencia,
                talla_col=nuevo_encargo.talla_col,
                talla_eur=nuevo_encargo.talla_eur,
                precio=formatear_pesos(nuevo_encargo.precio),
                abono=formatear_pesos(nuevo_encargo.abono),
                saldo=formatear_pesos(nuevo_encargo.saldo),
                fecha_estimada=nuevo_encargo.fecha_entrega_estimada,
            )
    except Exception as e:
        print("Exception al enviar WhatsApp al cliente:", type(e).__name__)
        respuesta_whatsapp_cliente = {"error": {"code": "LOCAL_EXCEPTION", "message": str(e)}}

    notif_cliente = registrar_resultado_envio(
        db, encargo_id=nuevo_encargo.id, destinatario="cliente", tipo="confirmacion",
        plantilla="confirmacion_encargo_foto" if image_url else "confirmacion_encargo",
        respuesta=respuesta_whatsapp_cliente,
    )

    # "accepted" = Meta aceptó la solicitud. La entrega real llega luego por webhook.
    if notif_cliente.estado != "accepted":
        # NO borrar el encargo de la BD. Conservar registro.
        # NO enviar notificación al proveedor si falló la notificación obligatoria al cliente.
        db.expire(nuevo_encargo, ["notificaciones_whatsapp"])
        nuevo_encargo.mensaje_advertencia = (
            f"El encargo fue creado en la base de datos, pero no fue posible enviar la notificación por WhatsApp al cliente ({notif_cliente.error_mensaje}). "
            f"No se envió notificación al proveedor."
        )
        return nuevo_encargo

    # 6. SI WHATSAPP ACEPTÓ EL MENSAJE DEL CLIENTE -> INTENTAR NOTIFICAR AL PROVEEDOR
    respuesta_whatsapp_proveedor = None
    try:
        if image_url:
            respuesta_whatsapp_proveedor = enviar_template_proveedor_foto(
                numero=telefono_proveedor_norm,
                image_url=image_url,
                referencia=nuevo_encargo.referencia,
                talla_eur=nuevo_encargo.talla_eur,
            )
        else:
            respuesta_whatsapp_proveedor = enviar_template_proveedor_encargo(
                numero=telefono_proveedor_norm,
                referencia=nuevo_encargo.referencia,
                talla_eur=nuevo_encargo.talla_eur,
            )
    except Exception as e:
        print("Error enviando template al proveedor:", type(e).__name__)
        respuesta_whatsapp_proveedor = {"error": {"code": "LOCAL_EXCEPTION", "message": str(e)}}

    notif_prov = registrar_resultado_envio(
        db, encargo_id=nuevo_encargo.id, destinatario="proveedor", tipo="proveedor",
        plantilla="notificacion_proveedor_foto" if image_url else "notificacion_proveedor_encargo",
        respuesta=respuesta_whatsapp_proveedor, proveedor_id=proveedor.id,
    )

    if notif_prov.estado == "accepted":
        try:
            nuevo_msg = MensajeProveedor(
                proveedor_id=proveedor.id,
                telefono=proveedor.telefono,
                nombre_perfil=None,
                direccion="saliente",
                tipo="image" if image_url else "text",
                contenido=f"Talla EUR: {nuevo_encargo.talla_eur}",
                media_url=image_url,
                whatsapp_message_id=notif_prov.wamid,
            )
            db.add(nuevo_msg)
            db.commit()
            print(f"[AUTO_MSG] Mensaje saliente automatico persistido en BD. wamid: {notif_prov.wamid}", flush=True)
        except Exception as e:
            db.rollback()
            print("Error persistiendo mensaje de proveedor:", type(e).__name__)
    else:
        nuevo_encargo.mensaje_advertencia = (
            f"El encargo fue creado y WhatsApp aceptó el mensaje del cliente, pero no fue posible notificar al proveedor ({notif_prov.error_mensaje}). "
            f"Puede utilizar la opción 'Reenviar a proveedor' más tarde."
        )

    db.expire(nuevo_encargo, ["notificaciones_whatsapp"])
    return nuevo_encargo


@router.get("/encargos", response_model=list[EncargoResponse])
def listar_encargos(
    estado: str | None = Query(default=None),
    buscar: str | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: str = Depends(get_current_user),
):
    import time
    start_time = time.time()

    query = db.query(Encargo).options(joinedload(Encargo.cliente), joinedload(Encargo.proveedor)).join(Cliente)

    if estado:
        query = query.filter(Encargo.estado == estado)

    if buscar:
        query = query.filter(
            or_(
                Cliente.nombre.ilike(f"%{buscar}%"),
                Cliente.telefono.ilike(f"%{buscar}%"),
                Encargo.referencia.ilike(f"%{buscar}%"),
                Encargo.id.cast(String).ilike(f"%{buscar}%"),
            )
        )

    encargos = query.order_by(Encargo.id.desc()).all()
    duration = time.time() - start_time
    print(f"[PERF] GET /encargos tardó {duration:.4f} segundos", flush=True)
    return encargos


@router.get("/encargos/{encargo_id}", response_model=EncargoResponse)
def obtener_encargo(
    encargo_id: int,
    db: Session = Depends(get_db),
    current_user: str = Depends(get_current_user),
):
    encargo = (
        db.query(Encargo)
        .options(joinedload(Encargo.cliente), joinedload(Encargo.proveedor))
        .filter(Encargo.id == encargo_id)
        .first()
    )

    if not encargo:
        raise HTTPException(status_code=404, detail="El encargo no existe")

    return encargo

def _es_lock_not_available(e: Exception) -> bool:
    """
    Verifica si la excepción corresponde estrictamente al error de PostgreSQL
    SQLSTATE 55P03 (lock_not_available), que ocurre cuando una fila ya está
    bloqueada por otra transacción y se ejecuta SELECT ... FOR UPDATE NOWAIT.
    """
    orig = getattr(e, "orig", None)
    pgcode = (
        getattr(orig, "pgcode", None)
        or getattr(orig, "sqlstate", None)
        or getattr(e, "pgcode", None)
    )
    return str(pgcode).strip().upper() == "55P03"

class ReenviarProveedorRequest(BaseModel):
    proveedor_id: int | None = None

@router.post("/encargos/{encargo_id}/reenviar-proveedor")
def reenviar_encargo_proveedor(
    encargo_id: int,
    request: ReenviarProveedorRequest | None = None,
    db: Session = Depends(get_db),
    current_user: str = Depends(get_current_user),
):
    """
    Reenvía de forma controlada la notificación del encargo al proveedor por WhatsApp.
    Permite seleccionar un proveedor alternativo en caso de reasignación.
    Protegido contra concurrencia con SELECT ... FOR UPDATE NOWAIT y ventana anti-duplicado.
    Considera éxito ÚNICAMENTE una respuesta válida de Meta que contenga un wamid.
    """
    # 1. Bloqueo atómico a nivel de fila en PostgreSQL para evitar reintentos concurrentes
    try:
        encargo = (
            db.query(Encargo)
            .filter(Encargo.id == encargo_id)
            .with_for_update(nowait=True)
            .first()
        )
    except Exception as e:
        db.rollback()
        if _es_lock_not_available(e):
            raise HTTPException(
                status_code=409,
                detail="Hay una operación concurrente en curso sobre este encargo. Por favor espere unos segundos.",
            )
        orig = getattr(e, "orig", None)
        sqlstate = getattr(orig, "pgcode", None) or getattr(orig, "sqlstate", None) or getattr(e, "pgcode", None)
        print(f"[ERROR] Error al bloquear encargo {encargo_id} para reenvio a proveedor: tipo={type(e).__name__}, sqlstate={sqlstate}", flush=True)
        raise HTTPException(
            status_code=500,
            detail="Error interno al consultar el encargo.",
        )

    if not encargo:
        raise HTTPException(status_code=404, detail="El encargo no existe")

    if encargo.estado in ["despachado", "en_local", "entregado", "cancelado"]:
        raise HTTPException(
            status_code=400,
            detail="Este encargo ya no debería reenviarse al proveedor",
        )

    proveedor_destino = None
    if request and request.proveedor_id:
        proveedor_destino = db.query(Proveedor).filter(Proveedor.id == request.proveedor_id).first()
        if not proveedor_destino:
            raise HTTPException(status_code=404, detail="El proveedor seleccionado no existe")
    else:
        proveedor_destino = encargo.proveedor

    if not proveedor_destino:
        raise HTTPException(
            status_code=400,
            detail="Este encargo no tiene proveedor asignado ni se especificó uno para el reenvío",
        )

    incierto_reciente_prov = consultar_envio_incierto_reciente(encargo.id, "proveedor")
    if incierto_reciente_prov:
        raise HTTPException(
            status_code=409,
            detail=(
                f"Existe un envío reciente aceptado por Meta (wamid={incierto_reciente_prov.get('wamid')}) "
                f"cuya persistencia local falló (rollback). No se permite el reenvío automático. "
                f"Verifique la entrega con el proveedor antes de intentar un nuevo envío."
            ),
        )

    if envio_reciente_en_vuelo(db, encargo.id, "proveedor"):
        raise HTTPException(
            status_code=409,
            detail="Ya se envió una notificación al proveedor hace unos segundos. Espere antes de reintentar.",
        )

    try:
        try:
            if encargo.foto:
                respuesta = enviar_template_proveedor_foto(
                    numero=proveedor_destino.telefono,
                    image_url=encargo.foto,
                    referencia=encargo.referencia,
                    talla_eur=encargo.talla_eur,
                )
            else:
                respuesta = enviar_template_proveedor_encargo(
                    numero=proveedor_destino.telefono,
                    referencia=encargo.referencia,
                    talla_eur=encargo.talla_eur,
                )
        except Exception as e:
            print("Error en llamada a WhatsApp proveedor:", e)
            respuesta = {"error": {"code": "CLIENT_EXCEPTION", "message": str(e)}}

        wamid_valido, error_meta = validar_respuesta_meta_wamid(respuesta)
        print("[REENVÍO WA PROV]", f"wamid={wamid_valido}" if wamid_valido else f"error={error_meta}")

        notif = registrar_resultado_envio(
            db, encargo_id=encargo.id, destinatario="proveedor", tipo="proveedor",
            plantilla="notificacion_proveedor_foto" if encargo.foto else "notificacion_proveedor_encargo",
            respuesta=respuesta if isinstance(respuesta, dict) else {"error": {"message": str(respuesta)}},
            proveedor_id=proveedor_destino.id,
        )

        if not wamid_valido:
            raise HTTPException(
                status_code=400,
                detail=error_meta or notif.error_mensaje or "No se pudo reenviar la notificación al proveedor por WhatsApp.",
            )

        if notif.estado == "incierto":
            raise HTTPException(
                status_code=409,
                detail=(
                    f"Meta aceptó el mensaje (wamid={notif.wamid}), pero ocurrió un fallo en la base de datos local "
                    f"y la transacción fue revertida (rollback). El estado no quedó guardado en el sistema. "
                    f"Estado incierto: NO reenviar automáticamente. Verifique la entrega con el proveedor antes de intentar un nuevo envío."
                ),
            )

        # Persistir mensaje automático enviado en base de datos si el intento fue exitoso y persistido
        if wamid_valido and getattr(notif, "persistencia_exitosa", True):
            try:
                nuevo_msg = MensajeProveedor(
                    proveedor_id=proveedor_destino.id,
                    telefono=proveedor_destino.telefono,
                    nombre_perfil=None,
                    direccion="saliente",
                    tipo="image" if encargo.foto else "text",
                    contenido=f"Talla EUR: {encargo.talla_eur}",
                    media_url=encargo.foto,
                    whatsapp_message_id=wamid_valido,
                    fecha_creacion=datetime.utcnow(),
                )
                db.add(nuevo_msg)
                db.commit()
                print(f"[AUTO_MSG_REENVIO] Mensaje saliente automatico reenviado persistido en BD. wamid: {wamid_valido}", flush=True)
            except Exception as e_msg:
                print(f"[WARN] Error guardando MensajeProveedor saliente: {e_msg}", flush=True)

        return {
            "mensaje": "WhatsApp aceptó el mensaje para el proveedor. El estado de entrega se actualizará automáticamente.",
            "encargo_id": encargo.id,
            "proveedor": proveedor_destino.nombre,
            "estado": notif.estado,
            "intento": notif.intento,
            "wamid": wamid_valido,
        }

    except HTTPException:
        raise
    except Exception as e:
        print("Error reenviando encargo al proveedor:", e)
        raise HTTPException(
            status_code=500,
            detail="Error reenviando encargo al proveedor",
        )

@router.post("/encargos/{encargo_id}/reenviar-cliente")
def reenviar_encargo_cliente(
    encargo_id: int,
    db: Session = Depends(get_db),
    current_user: str = Depends(get_current_user),
):
    """
    Reenvía la notificación por WhatsApp de confirmación de encargo al cliente.
    Protegido contra concurrencia con SELECT ... FOR UPDATE NOWAIT y ventana anti-duplicado.
    Considera éxito ÚNICAMENTE una respuesta válida de Meta que contenga un wamid.
    """
    try:
        encargo = (
            db.query(Encargo)
            .filter(Encargo.id == encargo_id)
            .with_for_update(nowait=True)
            .first()
        )
    except Exception as e:
        db.rollback()
        if _es_lock_not_available(e):
            raise HTTPException(
                status_code=409,
                detail="Hay una operación concurrente en curso sobre este encargo. Por favor espere unos segundos.",
            )
        orig = getattr(e, "orig", None)
        sqlstate = getattr(orig, "pgcode", None) or getattr(orig, "sqlstate", None) or getattr(e, "pgcode", None)
        print(f"[ERROR] Error al bloquear encargo {encargo_id} para reenvio a cliente: tipo={type(e).__name__}, sqlstate={sqlstate}", flush=True)
        raise HTTPException(
            status_code=500,
            detail="Error interno al consultar el encargo.",
        )

    if not encargo:
        raise HTTPException(status_code=404, detail="El encargo especificado no existe.")

    cliente = encargo.cliente
    if not cliente:
        raise HTTPException(status_code=404, detail="El cliente asociado a este encargo no existe.")

    if not cliente.nombre or not cliente.nombre.strip():
        raise HTTPException(
            status_code=400,
            detail="El cliente no tiene un nombre válido registrado."
        )

    if not cliente.telefono or not cliente.telefono.strip():
        raise HTTPException(
            status_code=400,
            detail="El cliente no tiene un número de teléfono registrado."
        )

    telefono_cliente_norm = validar_y_normalizar_telefono(cliente.telefono)
    if not telefono_cliente_norm:
        raise HTTPException(
            status_code=400,
            detail="El teléfono del cliente no es un número de WhatsApp válido (debe tener entre 10 y 15 dígitos)."
        )

    if not encargo.referencia or not encargo.referencia.strip():
        raise HTTPException(
            status_code=400,
            detail="El encargo no tiene una referencia válida."
        )

    if not encargo.talla_eur or not encargo.talla_eur.strip():
        raise HTTPException(
            status_code=400,
            detail="El encargo no tiene una talla EUR registrada."
        )

    if not encargo.fecha_entrega_estimada or not encargo.fecha_entrega_estimada.strip():
        raise HTTPException(
            status_code=400,
            detail="El encargo no tiene una fecha estimada de entrega registrada."
        )

    image_url = encargo.foto
    respuesta_whatsapp = None

    incierto_reciente_cli = consultar_envio_incierto_reciente(encargo.id, "cliente")
    if incierto_reciente_cli:
        raise HTTPException(
            status_code=409,
            detail=(
                f"Existe un envío reciente aceptado por Meta (wamid={incierto_reciente_cli.get('wamid')}) "
                f"cuya persistencia local falló (rollback). No se permite el reenvío automático. "
                f"Verifique la entrega con el cliente antes de intentar un nuevo envío."
            ),
        )

    if envio_reciente_en_vuelo(db, encargo.id, "cliente"):
        raise HTTPException(
            status_code=409,
            detail="Ya se envió una notificación al cliente hace unos segundos. Espere antes de reintentar.",
        )

    try:
        try:
            if image_url:
                respuesta_whatsapp = enviar_template_confirmacion_encargo_foto(
                    numero=telefono_cliente_norm,
                    image_url=image_url,
                    nombre=cliente.nombre,
                    referencia=encargo.referencia,
                    talla_col=encargo.talla_col,
                    talla_eur=encargo.talla_eur,
                    precio=formatear_pesos(encargo.precio),
                    abono=formatear_pesos(encargo.abono),
                    saldo=formatear_pesos(encargo.saldo),
                    fecha_estimada=encargo.fecha_entrega_estimada,
                )
            else:
                respuesta_whatsapp = enviar_template_confirmacion_encargo(
                    numero=telefono_cliente_norm,
                    nombre=cliente.nombre,
                    referencia=encargo.referencia,
                    talla_col=encargo.talla_col,
                    talla_eur=encargo.talla_eur,
                    precio=formatear_pesos(encargo.precio),
                    abono=formatear_pesos(encargo.abono),
                    saldo=formatear_pesos(encargo.saldo),
                    fecha_estimada=encargo.fecha_entrega_estimada,
                )
        except Exception as e:
            print("Error en llamada a WhatsApp cliente:", e)
            respuesta_whatsapp = {"error": {"code": "CLIENT_EXCEPTION", "message": str(e)}}

        wamid_valido, error_meta = validar_respuesta_meta_wamid(respuesta_whatsapp)
        print("[REENVÍO WA CLIENTE]", f"wamid={wamid_valido}" if wamid_valido else f"error={error_meta}")

        notif = registrar_resultado_envio(
            db, encargo_id=encargo.id, destinatario="cliente", tipo="confirmacion",
            plantilla="confirmacion_encargo_foto" if image_url else "confirmacion_encargo",
            respuesta=respuesta_whatsapp if isinstance(respuesta_whatsapp, dict) else {"error": {"message": str(respuesta_whatsapp)}},
        )

        if not wamid_valido:
            raise HTTPException(
                status_code=400,
                detail=error_meta or notif.error_mensaje or "No se pudo notificar al cliente por WhatsApp.",
            )

        if notif.estado == "incierto":
            raise HTTPException(
                status_code=409,
                detail=(
                    f"Meta aceptó el mensaje (wamid={notif.wamid}), pero ocurrió un fallo en la base de datos local "
                    f"y la transacción fue revertida (rollback). El estado no quedó guardado en el sistema. "
                    f"Estado incierto: NO reenviar automáticamente. Verifique la entrega con el cliente antes de intentar un nuevo envío."
                ),
            )

        return {
            "mensaje": "WhatsApp aceptó el mensaje para el cliente. El estado de entrega se actualizará automáticamente.",
            "encargo_id": encargo.id,
            "cliente": cliente.nombre,
            "estado": notif.estado,
            "intento": notif.intento,
            "wamid": wamid_valido,
        }

    except HTTPException:
        raise
    except Exception as e:
        print("Error reenviando notificación al cliente:", e)
        raise HTTPException(
            status_code=400,
            detail=f"Error al enviar notificación por WhatsApp al cliente: {str(e)}"
        )

@router.delete("/encargos/{encargo_id}")
def eliminar_encargo(
    encargo_id: int,
    db: Session = Depends(get_db),
    current_user: str = Depends(get_current_user),
):
    encargo = db.query(Encargo).filter(Encargo.id == encargo_id).first()

    if not encargo:
        raise HTTPException(status_code=404, detail="El encargo no existe")

    db.delete(encargo)
    db.commit()

    return {"mensaje": "Encargo eliminado correctamente"}


@router.put("/encargos/{encargo_id}/estado", response_model=EncargoResponse)
def actualizar_estado(
    encargo_id: int,
    data: EncargoEstadoUpdate,
    db: Session = Depends(get_db),
    current_user: str = Depends(get_current_user),
):
    # print("=== DEBUG DESPACHADO ===")
    # print("data.estado:", data.estado)
    # print("data.costo_base:", data.costo_base)
    # print("data.costo_envio:", data.costo_envio)
    # print("data.costo_despachador:", data.costo_despachador)
    # print("data dict:", data.dict())

    encargo = db.query(Encargo).filter(Encargo.id == encargo_id).first()

    if not encargo:
        raise HTTPException(status_code=404, detail="El encargo no existe")

    if data.estado not in ESTADOS_VALIDOS:
        raise HTTPException(status_code=400, detail="Estado no válido")

    if data.estado == "despachado":
        if (
            data.costo_base is None
            or data.costo_envio is None
            or data.costo_despachador is None
        ):
            raise HTTPException(
                status_code=400,
                detail="Se requieren costo_base, costo_envio y costo_despachador para despachar el encargo",
            )
        if (
            data.costo_base < 0
            or data.costo_envio < 0
            or data.costo_despachador < 0
        ):
            raise HTTPException(
                status_code=400,
                detail="Los costos no pueden ser negativos",
            )
        encargo.costo_base = data.costo_base
        encargo.costo_envio = data.costo_envio
        encargo.costo_despachador = data.costo_despachador
        encargo.costo_total = data.costo_base + data.costo_envio + data.costo_despachador
        encargo.utilidad_estimada = encargo.precio - encargo.costo_total
        encargo.fecha_despacho = str(date.today())

    if data.estado == "entregado":
        if encargo.saldo > 0:
            raise HTTPException(
                status_code=400,
                detail="No se puede entregar un encargo con saldo pendiente",
            )
        if encargo.costo_total is None or encargo.costo_total <= 0:
            raise HTTPException(
                status_code=400,
                detail="No se puede entregar un encargo sin registrar costos válidos (costo_total debe ser mayor a 0)",
            )

        if encargo.estado == "entregado" and encargo.metodo_pago:
            if data.metodo_pago and data.metodo_pago != encargo.metodo_pago:
                raise HTTPException(
                    status_code=400,
                    detail="No se permite modificar el método de pago una vez registrado",
                )
        else:
            if not data.metodo_pago or not data.metodo_pago.strip():
                raise HTTPException(
                    status_code=400,
                    detail="El método de pago es obligatorio para entregar el encargo",
                )

            metodos_permitidos = [
                "Efectivo",
                "Transferencia",
                "Tarjeta Débito",
                "Tarjeta Crédito",
                "Addi",
                "Sistecrédito",
            ]
            if data.metodo_pago not in metodos_permitidos:
                raise HTTPException(
                    status_code=400,
                    detail=f"Método de pago no permitido. Debe ser uno de: {', '.join(metodos_permitidos)}",
                )
            encargo.metodo_pago = data.metodo_pago

        # PROTECCIÓN DE INTEGRIDAD HISTÓRICA:
        # Si ya tiene fecha_entregado, NUNCA se sobrescribe.
        # Si está vacío o None, se asigna la fecha actual en zona Colombia (UTC-5).
        if not encargo.fecha_entregado or not str(encargo.fecha_entregado).strip():
            hoy_colombia = datetime.now(timezone(timedelta(hours=-5))).strftime("%Y-%m-%d")
            encargo.fecha_entregado = hoy_colombia

    if data.estado == "cancelado":
        if not data.motivo_cancelacion or not data.motivo_cancelacion.strip():
            raise HTTPException(
                status_code=400,
                detail="El motivo de cancelación es obligatorio para cancelar el encargo",
            )
        encargo.motivo_cancelacion = data.motivo_cancelacion.strip()
        encargo.fecha_cancelacion = str(date.today())

    estado_anterior = encargo.estado
    encargo.estado = data.estado

    # Generar venta automática al cambiar a entregado
    if data.estado == "entregado" and estado_anterior != "entregado":
        crear_venta_desde_encargo_si_no_existe(db, encargo)

    # print("encargo.costo_base:", encargo.costo_base)
    # print("encargo.costo_envio:", encargo.costo_envio)
    # print("encargo.costo_despachador:", encargo.costo_despachador)
    # print("encargo.costo_total:", encargo.costo_total)
    # print("encargo.utilidad_estimada:", encargo.utilidad_estimada)

    db.commit()
    db.refresh(encargo)

    if data.estado == "en_local" and estado_anterior != "en_local":
        if encargo.cliente and encargo.foto:
            try:
                image_url = encargo.foto

                resp_local = enviar_template_encargo_en_local(
                    numero=encargo.cliente.telefono,
                    image_url=image_url,
                    nombre=encargo.cliente.nombre,
                    referencia=encargo.referencia,
                    saldo=formatear_pesos(encargo.saldo),
                )
                registrar_resultado_envio(
                    db, encargo_id=encargo.id, destinatario="cliente", tipo="en_local",
                    plantilla="encargo_en_local_foto", respuesta=resp_local,
                )
                db.expire(encargo, ["notificaciones_whatsapp"])
            except Exception as e:
                print("Error enviando WhatsApp en local:", type(e).__name__, e)

    return encargo


@router.put("/encargos/{encargo_id}/abono", response_model=EncargoResponse)
def actualizar_abono(
    encargo_id: int,
    data: EncargoAbonoUpdate,
    db: Session = Depends(get_db),
    current_user: str = Depends(get_current_user),
):
    encargo = db.query(Encargo).filter(Encargo.id == encargo_id).first()

    if not encargo:
        raise HTTPException(status_code=404, detail="El encargo no existe")

    if data.abono <= 0:
        raise HTTPException(
            status_code=400, detail="El nuevo abono debe ser mayor que 0"
        )

    nuevo_total_abonado = encargo.abono + data.abono
    saldo = validar_finanzas(encargo.precio, nuevo_total_abonado)

    encargo.abono = nuevo_total_abonado
    encargo.saldo = saldo

    db.commit()
    db.refresh(encargo)

    return encargo


@router.put("/encargos/{encargo_id}", response_model=EncargoResponse)
def editar_encargo(
    encargo_id: int,
    data: EncargoUpdate,
    db: Session = Depends(get_db),
    current_user: str = Depends(get_current_user),
):
    encargo = db.query(Encargo).filter(Encargo.id == encargo_id).first()

    if not encargo:
        raise HTTPException(status_code=404, detail="El encargo no existe")

    if encargo.estado == "entregado":
        raise HTTPException(
            status_code=400, detail="No se puede editar un encargo entregado"
        )

    proveedor = None
    if data.proveedor_id is not None:
        proveedor = (
            db.query(Proveedor).filter(Proveedor.id == data.proveedor_id).first()
        )

        if not proveedor:
            raise HTTPException(status_code=404, detail="El proveedor no existe")

    saldo = validar_finanzas(data.precio, encargo.abono)

    encargo.proveedor_id = data.proveedor_id
    encargo.referencia = data.referencia
    encargo.talla_eur = data.talla_eur
    encargo.talla_col = data.talla_col
    encargo.foto = data.foto
    encargo.precio = data.precio
    encargo.fecha_entrega_estimada = data.fecha_entrega_estimada
    encargo.observaciones = data.observaciones
    encargo.saldo = saldo

    if encargo.costo_total is not None:
        encargo.utilidad_estimada = data.precio - encargo.costo_total

    if proveedor is not None:
        encargo.proveedor = proveedor

    db.commit()
    db.refresh(encargo)

    return encargo


@router.put("/encargos/{encargo_id}/costos", response_model=EncargoResponse)
def actualizar_costos(
    encargo_id: int,
    data: EncargoCostosUpdate,
    db: Session = Depends(get_db),
    current_user: str = Depends(get_current_user),
):
    """
    Actualiza exclusivamente los costos de un encargo y sincroniza con la venta asociada (si existe).
    No modifica estado, fecha_entregado, fecha_despacho, precio, abono ni saldo.
    Permitido para cualquier encargo, incluso en estado 'entregado'.
    """
    encargo = db.query(Encargo).filter(Encargo.id == encargo_id).first()
    if not encargo:
        raise HTTPException(status_code=404, detail="El encargo no existe")

    # 1. Actualizar costos en el encargo y recalcular
    costo_total = data.costo_base + data.costo_envio + data.costo_despachador
    encargo.costo_base = data.costo_base
    encargo.costo_envio = data.costo_envio
    encargo.costo_despachador = data.costo_despachador
    encargo.costo_total = costo_total
    encargo.utilidad_estimada = (encargo.precio or 0.0) - costo_total

    # 2. Sincronizar con la venta asociada (si existe) en la misma transacción
    try:
        venta_asociada = db.query(Venta).filter(Venta.encargo_id == encargo.id).first()
        if venta_asociada:
            venta_asociada.costo_base = data.costo_base
            venta_asociada.costo_envio = data.costo_envio
            venta_asociada.costo_despachador = data.costo_despachador
            venta_asociada.costo_total = costo_total
            subt = venta_asociada.subtotal if venta_asociada.subtotal is not None else (venta_asociada.precio_venta or encargo.precio or 0.0)
            venta_asociada.utilidad = subt - costo_total

        db.commit()
        db.refresh(encargo)
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error al sincronizar costos: {str(e)}")

    return encargo

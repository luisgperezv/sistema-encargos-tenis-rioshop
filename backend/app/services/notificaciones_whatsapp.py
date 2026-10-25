"""
Persistencia y actualización idempotente de estados de notificaciones WhatsApp.

Reglas:
- HTTP 200 de Meta => estado "accepted" (solo aceptación inicial, NO entrega).
- Los estados del webhook avanzan monotónicamente: accepted < sent < delivered < read.
  Un webhook duplicado o que llega desordenado (p.ej. "sent" después de "read")
  no hace retroceder el estado.
- "failed" se aplica salvo que el mensaje ya se haya confirmado como delivered/read.
- El procesamiento de estados JAMÁS envía mensajes (evita bucles).
- Si un webhook llega antes de persistir la fila en notificaciones_whatsapp, se guarda
  en `estados_webhook_pendientes` sin bloquear el event loop (sin time.sleep) y se
  consume de forma atómica en cuanto el hilo emisor persiste la notificación.
- Diferenciación clara entre aceptación externa por Meta y persistencia local en BD:
  si db.commit() falla tras aceptación de Meta, se reporta estado "incierto"
  con persistencia_exitosa=False, id=None y advertencia anti-duplicado.

Limitación arquitectónica documentada:
- Si PostgreSQL sufre un fallo completo de conexión o persistencia (rollback de transacción),
  el estado 'incierto' no queda persistido en disco de base de datos.
- Se implementa una salvaguarda en memoria de proceso (_ENVIOS_EN_VUELO_MEMORIA) protegida por lock,
  que mantiene la ventana anti-duplicados de 30 segundos activa para bloquear reenvíos automáticos
  e informar al operador que debe verificar manualmente la entrega.
- LIMITACIÓN: En una arquitectura sin colas de tareas distribuidas (RabbitMQ/Celery) ni almacenamiento
  compartido independiente (Redis/Transactional Outbox), si el proceso se reinicia o se ejecuta
  en múltiples instancias no coordinadas durante una caída total de PostgreSQL, la memoria local
  no persistirá. Por tanto, no existe garantía absoluta contra duplicados en caso de fallo total
  de PostgreSQL combinado con reinicio del proceso. La salvaguarda aplicada es la máxima verificable
  dentro de los límites de la infraestructura actual.
"""

from datetime import datetime, timedelta
import threading
from typing import Any

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.notificacion_whatsapp import (
    NotificacionWhatsapp,
    EstadoWebhookPendiente,
    ESTADOS_WHATSAPP_RANGO,
    ESTADO_FALLIDO,
    ESTADO_INCIERTO,
)

VENTANA_ANTI_DUPLICADO = timedelta(seconds=30)
MAX_LONGITUD_ERROR = 500

_lock_envios_memoria = threading.Lock()
# Registro en memoria por tupla (encargo_id, destinatario) para proteger la ventana anti-duplicados
# aun en caso de que la transacción de PostgreSQL falle o sufra un rollback.
_ENVIOS_EN_VUELO_MEMORIA: dict[tuple[int, str], dict[str, Any]] = {}


def consultar_envio_incierto_reciente(encargo_id: int, destinatario: str) -> dict[str, Any] | None:
    """
    Retorna los datos del envío reciente con resultado incierto (Meta aceptó con wamid
    pero la persistencia local en PostgreSQL falló y ejecutó rollback) si se encuentra
    dentro de la ventana anti-duplicados de 30 segundos.
    """
    ahora = datetime.utcnow()
    with _lock_envios_memoria:
        reciente = _ENVIOS_EN_VUELO_MEMORIA.get((encargo_id, destinatario))
        if reciente and reciente.get("estado") == ESTADO_INCIERTO:
            if ahora - reciente["timestamp"] < VENTANA_ANTI_DUPLICADO:
                return reciente
    return None


def validar_respuesta_meta_wamid(respuesta: Any) -> tuple[str | None, str | None]:
    """
    Valida estrictamente que la respuesta de Meta WhatsApp API contenga un wamid válido.
    Retorna (wamid, None) si es una respuesta válida de aceptación de WhatsApp.
    Retorna (None, motivo_error) si es None, string, dict vacío o malformado, o trae error de Meta.
    """
    if respuesta is None:
        return None, "Respuesta vacía (None) recibida del servicio de WhatsApp."
    if not isinstance(respuesta, dict):
        return None, f"Respuesta malformada recibida de WhatsApp: tipo '{type(respuesta).__name__}'."
    if "error" in respuesta:
        err = respuesta["error"]
        msg = err.get("message") if isinstance(err, dict) else str(err)
        code = err.get("code") if isinstance(err, dict) else ""
        return None, f"Meta rechazó el mensaje (código: {code}): {msg}"
    mensajes = respuesta.get("messages")
    if not isinstance(mensajes, list) or len(mensajes) == 0:
        return None, "Respuesta de Meta no contiene lista de mensajes ('messages' vacío o ausente)."
    primer_msg = mensajes[0]
    if not isinstance(primer_msg, dict):
        return None, "Formato de mensaje inválido en la respuesta de Meta."
    wamid = primer_msg.get("id")
    if not wamid or not isinstance(wamid, str) or not wamid.strip():
        return None, "La respuesta de Meta no incluye un identificador 'id' (wamid) válido."
    return wamid.strip(), None


def _siguiente_intento(db: Session, encargo_id: int | None, destinatario: str) -> int:
    if encargo_id is None:
        return 1
    actual = (
        db.query(func.max(NotificacionWhatsapp.intento))
        .filter(
            NotificacionWhatsapp.encargo_id == encargo_id,
            NotificacionWhatsapp.destinatario == destinatario,
        )
        .scalar()
    )
    return (actual or 0) + 1


def envio_reciente_en_vuelo(db: Session, encargo_id: int, destinatario: str) -> bool:
    """
    Comprueba si existe un envío reciente hacia el destinatario para este encargo
    dentro de la ventana anti-duplicados (30 segundos).

    Protección dual:
    1. Registro volátil en memoria: detecta envíos en vuelo o aceptados por Meta aun
       cuando la transacción de PostgreSQL haya sufrido un rollback.
    2. Consulta en base de datos: comprueba registros persistidos previamente.
    """
    ahora = datetime.utcnow()

    # 1. Verificación en memoria del proceso:
    with _lock_envios_memoria:
        # Purgar claves expiradas para mantener la memoria acotada
        expirados = [
            k for k, v in _ENVIOS_EN_VUELO_MEMORIA.items()
            if ahora - v["timestamp"] >= VENTANA_ANTI_DUPLICADO
        ]
        for k in expirados:
            del _ENVIOS_EN_VUELO_MEMORIA[k]

        reciente_mem = _ENVIOS_EN_VUELO_MEMORIA.get((encargo_id, destinatario))
        if reciente_mem:
            # Si fue aceptado por Meta o su estado no es fallido dentro de la ventana de 30s
            if reciente_mem.get("aceptado_externamente") or reciente_mem.get("estado") != ESTADO_FALLIDO:
                if ahora - reciente_mem["timestamp"] < VENTANA_ANTI_DUPLICADO:
                    return True

    # 2. Verificación en base de datos persistida:
    try:
        ultimo = (
            db.query(NotificacionWhatsapp)
            .filter(
                NotificacionWhatsapp.encargo_id == encargo_id,
                NotificacionWhatsapp.destinatario == destinatario,
            )
            .order_by(NotificacionWhatsapp.id.desc())
            .first()
        )
        if not ultimo or ultimo.estado == ESTADO_FALLIDO:
            return False
        return ahora - ultimo.fecha_creacion < VENTANA_ANTI_DUPLICADO
    except Exception as e:
        print(f"[WARN] Error consultando envio_reciente_en_vuelo en BD: {type(e).__name__}", flush=True)
        return False


def registrar_resultado_envio(
    db: Session,
    *,
    encargo_id: int | None,
    destinatario: str,
    tipo: str,
    plantilla: str | None,
    respuesta: dict | None,
    proveedor_id: int | None = None,
) -> NotificacionWhatsapp:
    """
    Crea una fila de intento a partir de la respuesta síncrona de Meta (o error local).
    Consume de forma atómica cualquier estado pendiente que haya llegado previamente por webhook.

    Seguridad ante fallos de persistencia:
    - Si Meta aceptó el mensaje (existe wamid) pero db.commit() falla localmente, NO se devuelve
      un objeto que aparente estar correctamente persistido ni con id simulado.
    - Se retorna con estado='incierto', persistencia_exitosa=False, aceptado_externamente=True, id=None.
    - Esto diferencia con certeza la aceptación externa de la persistencia local fallida y evita
      reenvíos automáticos que duplicarían mensajes en WhatsApp.
    """
    ahora = datetime.utcnow()
    notif = NotificacionWhatsapp(
        encargo_id=encargo_id,
        destinatario=destinatario,
        proveedor_id=proveedor_id,
        tipo=tipo,
        plantilla=plantilla,
        intento=_siguiente_intento(db, encargo_id, destinatario),
        fecha_creacion=ahora,
        fecha_actualizacion=ahora,
    )

    wamid_valido, error_meta = validar_respuesta_meta_wamid(respuesta)
    meta_aceptado = bool(wamid_valido)

    if meta_aceptado:
        notif.wamid = wamid_valido
        notif.estado = "accepted"
        notif.aceptado_externamente = True
        media = (respuesta.get("_media") if isinstance(respuesta, dict) else None) or {}
        notif.media_url_enviada = media.get("url")
        notif.media_bytes = media.get("bytes")

        # Consumir estado pendiente si el webhook llegó antes de este commit
        try:
            pend = db.query(EstadoWebhookPendiente).filter(EstadoWebhookPendiente.wamid == notif.wamid).first()
            if pend:
                notif.estado = pend.estado
                notif.error_codigo = pend.error_codigo
                notif.error_mensaje = pend.error_mensaje
                notif.ultimo_timestamp_meta = pend.ultimo_timestamp_meta
                db.delete(pend)
                print(f"[WA_PENDIENTE_APLICADO] wamid={notif.wamid} estado={pend.estado}", flush=True)
        except Exception as e:
            print(f"[WA_PENDIENTE_WARN] Error consultando estados pendientes: {type(e).__name__}", flush=True)

    else:
        notif.wamid = None
        notif.estado = ESTADO_FALLIDO
        notif.aceptado_externamente = False
        err = respuesta.get("error") if isinstance(respuesta, dict) else respuesta
        if isinstance(err, dict):
            notif.error_codigo = str(err.get("code") or "")[:20] or None
            notif.error_mensaje = str(err.get("message") or error_meta or "Error desconocido")[:MAX_LONGITUD_ERROR]
        else:
            notif.error_mensaje = str(error_meta or err or "Respuesta vacía o inválida de WhatsApp")[:MAX_LONGITUD_ERROR]

    db.add(notif)
    try:
        db.commit()
        db.refresh(notif)
        notif.persistencia_exitosa = True
    except Exception as e:
        db.rollback()
        notif.persistencia_exitosa = False
        notif.id = None  # NO simular id=0 como si estuviese persistido en base de datos

        if meta_aceptado:
            # Meta aceptó el mensaje, pero la BD local no pudo confirmar la transacción.
            # Informar explícitamente el estado incierto y evitar reenvíos automáticos.
            notif.estado = ESTADO_INCIERTO
            notif.error_codigo = "PERSISTENCIA_FALLIDA"
            notif.error_mensaje = (
                f"Meta aceptó el mensaje (wamid={notif.wamid}), pero ocurrió un fallo al guardar en la base de datos local "
                f"({type(e).__name__}). La transacción fue revertida (rollback) y el estado NO quedó persistido en la base de datos. "
                f"Estado incierto: NO reenviar automáticamente; verifique la entrega antes de intentar un nuevo envío."
            )
            print(
                f"[CRITICAL_PERSIST_WA] Aceptado externamente pero falló commit local (rollback ejecutado, no persistido en BD). "
                f"wamid={notif.wamid}: {type(e).__name__} {e}. Incierto en memoria: verificar entrega antes de reenviar.",
                flush=True,
            )
        else:
            notif.estado = ESTADO_FALLIDO
            notif.error_codigo = notif.error_codigo or "LOCAL_DB_ERROR"
            notif.error_mensaje = f"Error al registrar intento en BD: {type(e).__name__}"

    if encargo_id is not None:
        with _lock_envios_memoria:
            _ENVIOS_EN_VUELO_MEMORIA[(encargo_id, destinatario)] = {
                "timestamp": ahora,
                "wamid": notif.wamid,
                "estado": notif.estado,
                "aceptado_externamente": meta_aceptado,
                "persistencia_exitosa": getattr(notif, "persistencia_exitosa", False),
            }

    return notif


def aplicar_estado_webhook(db: Session, status: dict) -> str:
    """
    Aplica un objeto `statuses[]` del webhook de forma idempotente y NO bloqueante.
    Si la fila de notificaciones_whatsapp aún no se ha guardado (caso de carrera),
    el estado se almacena de forma durable en `estados_webhook_pendientes` para ser
    consumido por el hilo emisor en cuanto inserte la notificación.
    Nunca utiliza time.sleep() ni bloquea el event loop.
    """
    wamid = status.get("id")
    nuevo = (status.get("status") or "").lower()
    if not wamid or (nuevo not in ESTADOS_WHATSAPP_RANGO and nuevo != ESTADO_FALLIDO):
        return "invalido"

    try:
        ts = int(status.get("timestamp")) if status.get("timestamp") else None
    except (TypeError, ValueError):
        ts = None

    notif = db.query(NotificacionWhatsapp).filter(NotificacionWhatsapp.wamid == wamid).first()
    if not notif:
        # El wamid aún no está en notificaciones_whatsapp: guardar en estados_webhook_pendientes
        pend = db.query(EstadoWebhookPendiente).filter(EstadoWebhookPendiente.wamid == wamid).first()
        if not pend:
            pend = EstadoWebhookPendiente(
                wamid=wamid,
                estado=nuevo,
                ultimo_timestamp_meta=ts,
                fecha_creacion=datetime.utcnow(),
            )
            if nuevo == ESTADO_FALLIDO:
                errores = status.get("errors") or []
                if errores and isinstance(errores[0], dict):
                    e = errores[0]
                    pend.error_codigo = str(e.get("code") or "")[:20] or None
                    detalle = (e.get("error_data") or {}).get("details") if isinstance(e.get("error_data"), dict) else None
                    pend.error_mensaje = str(detalle or e.get("message") or e.get("title") or "Fallo reportado")[:MAX_LONGITUD_ERROR]
            db.add(pend)
            db.commit()
            return "guardado_pendiente"
        else:
            actual = pend.estado
            if nuevo == ESTADO_FALLIDO:
                if actual != ESTADO_FALLIDO and ESTADOS_WHATSAPP_RANGO.get(actual, -1) < ESTADOS_WHATSAPP_RANGO["delivered"]:
                    pend.estado = ESTADO_FALLIDO
                    errores = status.get("errors") or []
                    if errores and isinstance(errores[0], dict):
                        e = errores[0]
                        pend.error_codigo = str(e.get("code") or "")[:20] or None
                        detalle = (e.get("error_data") or {}).get("details") if isinstance(e.get("error_data"), dict) else None
                        pend.error_mensaje = str(detalle or e.get("message") or e.get("title") or "Fallo reportado")[:MAX_LONGITUD_ERROR]
                    db.commit()
                    return "actualizado_pendiente"
                return "ignorado_retroceso"
            elif ESTADOS_WHATSAPP_RANGO[nuevo] > ESTADOS_WHATSAPP_RANGO.get(actual, -1):
                pend.estado = nuevo
                if ts is not None:
                    pend.ultimo_timestamp_meta = ts
                db.commit()
                return "actualizado_pendiente"
            return "ignorado_duplicado"

    actual = notif.estado
    cambiar = False

    if nuevo == ESTADO_FALLIDO:
        if actual == ESTADO_FALLIDO:
            return "ignorado_duplicado"
        # Si ya se confirmó entrega/lectura, un failed tardío no la revierte.
        if ESTADOS_WHATSAPP_RANGO.get(actual, -1) >= ESTADOS_WHATSAPP_RANGO["delivered"]:
            return "ignorado_retroceso"
        cambiar = True
        errores = status.get("errors") or []
        if errores and isinstance(errores[0], dict):
            e = errores[0]
            notif.error_codigo = str(e.get("code") or "")[:20] or None
            detalle = (e.get("error_data") or {}).get("details") if isinstance(e.get("error_data"), dict) else None
            mensaje = detalle or e.get("message") or e.get("title") or "Fallo reportado por WhatsApp"
            notif.error_mensaje = str(mensaje)[:MAX_LONGITUD_ERROR]
    else:
        if nuevo == actual:
            return "ignorado_duplicado"
        if actual == ESTADO_FALLIDO:
            if ESTADOS_WHATSAPP_RANGO[nuevo] < ESTADOS_WHATSAPP_RANGO["delivered"]:
                return "ignorado_retroceso"
            cambiar = True
        elif ESTADOS_WHATSAPP_RANGO[nuevo] > ESTADOS_WHATSAPP_RANGO.get(actual, -1):
            cambiar = True
        else:
            return "ignorado_retroceso"

    if cambiar:
        notif.estado = nuevo
        if ts is not None and (notif.ultimo_timestamp_meta is None or ts > notif.ultimo_timestamp_meta):
            notif.ultimo_timestamp_meta = ts
        notif.fecha_actualizacion = datetime.utcnow()
        db.commit()
        return "actualizado"
    return "ignorado_duplicado"

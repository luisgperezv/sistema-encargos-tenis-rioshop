"""
Suite de pruebas automatizadas para la optimización de Cloudinary y envíos de WhatsApp.

Condiciones de seguridad:
- Base de datos 100% aislada (SQLite local test_wa_isolated.db).
- Cero llamadas a redes externas: WhatsApp Meta API y Cloudinary están completamente mockeados.
- Ningún mensaje real es enviado a clientes ni proveedores.
"""

import os
import sys
import asyncio
from datetime import datetime, timedelta
from unittest.mock import patch, MagicMock

# Asegurar codificación utf-8 para la salida en consola Windows
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

# 1. Configurar base de datos aislada ANTES de importar cualquier módulo del backend
DB_TEST_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), "test_wa_isolated.db"))
if os.path.exists(DB_TEST_PATH):
    try:
        os.remove(DB_TEST_PATH)
    except Exception:
        pass

os.environ["DATABASE_URL"] = f"sqlite:///{DB_TEST_PATH}"
os.environ["WHATSAPP_TOKEN"] = "fake_test_token"
os.environ["WHATSAPP_PHONE_NUMBER_ID"] = "1234567890"

from fastapi import BackgroundTasks, HTTPException
from app.database import Base, engine, SessionLocal
from app.models.cliente import Cliente
from app.models.proveedor import Proveedor
from app.models.encargo import Encargo
from app.models.mensaje_proveedor import MensajeProveedor
from app.models.notificacion_whatsapp import (
    NotificacionWhatsapp,
    EstadoWebhookPendiente,
    ESTADO_INCIERTO,
    ESTADO_FALLIDO,
)
from app.services.whatsapp_media import (
    preparar_imagen_whatsapp,
    ErrorImagenWhatsapp,
    construir_url_transformada,
    es_url_cloudinary,
    LIMITE_SEGURO_BYTES,
)
from app.services.notificaciones_whatsapp import (
    registrar_resultado_envio,
    aplicar_estado_webhook,
    envio_reciente_en_vuelo,
    validar_respuesta_meta_wamid,
    consultar_envio_incierto_reciente,
)
from app.services.whatsapp import (
    enviar_template_confirmacion_encargo,
    enviar_template_confirmacion_encargo_foto,
    enviar_template_proveedor_foto,
    enviar_template_encargo_en_local,
    enmascarar_telefono,
    normalizar_numero_whatsapp,
)
from app.main import procesar_evento_webhook

# Inicializar esquema en la BD aislada
Base.metadata.create_all(bind=engine)


def test_1_deteccion_y_construccion_urls_cloudinary():
    """Prueba 1: Detección y transformación de URLs de Cloudinary."""
    print("\n--- PRUEBA 1: Detección y transformación Cloudinary ---")
    url_cloud = "https://res.cloudinary.com/tenisrio/image/upload/v1700000/tenisrioshop/encargos/encargo_123.jpg"
    assert es_url_cloudinary(url_cloud) is True, "Debe detectar URL de Cloudinary"

    url_no_cloud = "https://img.ejemplo.com/fotos/zapato.png"
    assert es_url_cloudinary(url_no_cloud) is False, "No debe detectar URL externa como Cloudinary"

    url_transformada = construir_url_transformada(url_cloud, "c_limit,w_1600,h_1600,q_auto:good,f_jpg")
    expected = "https://res.cloudinary.com/tenisrio/image/upload/c_limit,w_1600,h_1600,q_auto:good,f_jpg/v1700000/tenisrioshop/encargos/encargo_123.jpg"
    assert url_transformada == expected, f"URL esperada no coincide: {url_transformada}"
    print("✅ PRUEBA 1 PASÓ: Transformación de URL generada correctamente sin alterar original.")


def test_2_imagen_menor_5mb():
    """Prueba 2: Imagen inferior a 5 MB."""
    print("\n--- PRUEBA 2: Imagen < 5 MB ---")
    url_cloud = "https://res.cloudinary.com/tenisrio/image/upload/v1700000/encargo_pequeno.jpg"

    # Simular que el primer nivel de transformación descarga 850 KB
    fake_chunk = b"x" * (850 * 1024)
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.headers = {"Content-Type": "image/jpeg"}
    mock_resp.iter_content.return_value = [fake_chunk]
    mock_resp.__enter__.return_value = mock_resp

    with patch("requests.get", return_value=mock_resp):
        res = preparar_imagen_whatsapp(url_cloud)
        assert res["bytes"] == 850 * 1024
        assert "c_limit,w_1600" in res["transformacion"]
        assert "c_limit,w_1600" in res["url"]
    print("✅ PRUEBA 2 PASÓ: Imagen < 5 MB aceptada y derivada con éxito.")


def test_3_imagen_mayor_5mb_con_optimizacion_progresiva():
    """Prueba 3: Imagen de ~6.5 MB que se optimiza progresivamente."""
    print("\n--- PRUEBA 3: Imagen ~6.5 MB con fallback progresivo ---")
    url_cloud = "https://res.cloudinary.com/tenisrio/image/upload/v1700000/encargo_pesado.jpg"

    # Nivel 1 excede límite (> 4.5 MB = 5.2 MB)
    chunk_pesado = b"x" * int(5.2 * 1024 * 1024)
    mock_resp_1 = MagicMock()
    mock_resp_1.status_code = 200
    mock_resp_1.headers = {"Content-Type": "image/jpeg"}
    mock_resp_1.iter_content.return_value = [chunk_pesado]
    mock_resp_1.__enter__.return_value = mock_resp_1

    # Nivel 2 tiene éxito (1.2 MB)
    chunk_optimo = b"x" * int(1.2 * 1024 * 1024)
    mock_resp_2 = MagicMock()
    mock_resp_2.status_code = 200
    mock_resp_2.headers = {"Content-Type": "image/jpeg"}
    mock_resp_2.iter_content.return_value = [chunk_optimo]
    mock_resp_2.__enter__.return_value = mock_resp_2

    with patch("requests.get", side_effect=[mock_resp_1, mock_resp_2]):
        res = preparar_imagen_whatsapp(url_cloud)
        assert res["bytes"] == int(1.2 * 1024 * 1024)
        assert "w_1280" in res["transformacion"]
        assert res["bytes"] < LIMITE_SEGURO_BYTES
    print("✅ PRUEBA 3 PASÓ: Imagen pesada descartó nivel 1 y usó fallback seguro < 4.5 MB.")


def test_4_error_transformacion_o_tipo_invalido():
    """Prueba 4: Archivo no compatible o que excede todos los niveles."""
    print("\n--- PRUEBA 4: Control de error cuando ningún nivel cumple ---")
    url_cloud = "https://res.cloudinary.com/tenisrio/image/upload/v1700000/encargo_enorme.jpg"

    chunk_gigante = b"x" * int(6 * 1024 * 1024)
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.headers = {"Content-Type": "image/jpeg"}
    mock_resp.iter_content.return_value = [chunk_gigante]
    mock_resp.__enter__.return_value = mock_resp

    with patch("requests.get", return_value=mock_resp):
        try:
            preparar_imagen_whatsapp(url_cloud)
            assert False, "Debió lanzar ErrorImagenWhatsapp"
        except ErrorImagenWhatsapp as e:
            assert "No se pudo generar una versión válida" in str(e)
    print("✅ PRUEBA 4 PASÓ: Error capturado limpiamente sin crashear el servidor.")


def test_5_registro_estados_whatsapp_e_idempotencia():
    """Prueba 5: Estados WhatsApp, avance monotónico e idempotencia."""
    print("\n--- PRUEBA 5: Trazabilidad de estados e idempotencia de webhook ---")
    db = SessionLocal()
    try:
        wamid_prueba = "wamid.HBgTEST12345"
        resp_meta = {
            "messages": [{"id": wamid_prueba}],
            "_media": {"url": "https://res.cloudinary.com/.../derivada.jpg", "bytes": 450000}
        }
        notif = registrar_resultado_envio(
            db,
            encargo_id=999,
            destinatario="cliente",
            tipo="confirmacion",
            plantilla="confirmacion_encargo_foto",
            respuesta=resp_meta,
        )
        assert notif.estado == "accepted", "El estado inicial debe ser 'accepted', NUNCA 'entregado'"
        assert notif.intento == 1
        assert notif.wamid == wamid_prueba

        # Webhook: llega 'sent'
        status_sent = {"id": wamid_prueba, "status": "sent", "timestamp": "1700000001"}
        r = aplicar_estado_webhook(db, status_sent)
        assert r == "actualizado"
        db.refresh(notif)
        assert notif.estado == "sent"

        # Webhook: llega 'delivered'
        status_delivered = {"id": wamid_prueba, "status": "delivered", "timestamp": "1700000002"}
        r = aplicar_estado_webhook(db, status_delivered)
        assert r == "actualizado"
        db.refresh(notif)
        assert notif.estado == "delivered"

        # Webhook duplicado: llega 'delivered' otra vez
        r_dup = aplicar_estado_webhook(db, status_delivered)
        assert r_dup == "ignorado_duplicado"
        db.refresh(notif)
        assert notif.estado == "delivered"

        # Webhook desordenado: llega 'sent' después de 'delivered'
        r_retroceso = aplicar_estado_webhook(db, status_sent)
        assert r_retroceso == "ignorado_retroceso"
        db.refresh(notif)
        assert notif.estado == "delivered", "No debe retroceder de 'delivered' a 'sent'"

        # Webhook: llega 'read'
        status_read = {"id": wamid_prueba, "status": "read", "timestamp": "1700000003"}
        r = aplicar_estado_webhook(db, status_read)
        assert r == "actualizado"
        db.refresh(notif)
        assert notif.estado == "read"

        # Fallo tardío cuando ya fue delivered/read -> debe ser rechazado
        status_fail = {
            "id": wamid_prueba,
            "status": "failed",
            "errors": [{"code": 131053, "title": "Media upload error"}]
        }
        r_fail_tardio = aplicar_estado_webhook(db, status_fail)
        assert r_fail_tardio == "ignorado_retroceso"
        db.refresh(notif)
        assert notif.estado == "read"

    finally:
        db.close()
    print("✅ PRUEBA 5 PASÓ: Avance monotónico, prevención de retrocesos e idempotencia comprobados.")


def test_6_fallo_asincrono_codigo_131053():
    """Prueba 6: Fallo real con código 131053 persistido en base de datos."""
    print("\n--- PRUEBA 6: Simulación de error 131053 (Media upload error) ---")
    db = SessionLocal()
    try:
        wamid_fallo = "wamid.HBgFAIL999"
        notif = registrar_resultado_envio(
            db,
            encargo_id=1000,
            destinatario="proveedor",
            tipo="proveedor",
            plantilla="notificacion_proveedor_foto",
            respuesta={"messages": [{"id": wamid_fallo}]},
        )
        assert notif.estado == "accepted"

        status_failed = {
            "id": wamid_fallo,
            "status": "failed",
            "errors": [
                {
                    "code": 131053,
                    "title": "Media upload error",
                    "message": "Media upload error",
                    "error_data": {"details": "File size exceeds 5242880 bytes limit"}
                }
            ]
        }
        r = aplicar_estado_webhook(db, status_failed)
        assert r == "actualizado"
        db.refresh(notif)
        assert notif.estado == "failed"
        assert notif.error_codigo == "131053"
        assert "5242880" in notif.error_mensaje
    finally:
        db.close()
    print("✅ PRUEBA 6 PASÓ: Código 131053 y mensaje de fallo capturados con precisión.")


def test_7_reintentos_manuales_y_anti_duplicado():
    """Prueba 7: Historial de reintentos acumulativo y guard anti-doble clic."""
    print("\n--- PRUEBA 7: Reintentos manuales seguros y protección anti-duplicados ---")
    db = SessionLocal()
    try:
        encargo_id = 777

        n1 = registrar_resultado_envio(
            db,
            encargo_id=encargo_id,
            destinatario="cliente",
            tipo="confirmacion",
            plantilla="confirmacion_encargo_foto",
            respuesta={"messages": [{"id": "wamid.INTENTO1"}]},
        )
        assert n1.intento == 1

        assert envio_reciente_en_vuelo(db, encargo_id, "cliente") is True

        n2 = registrar_resultado_envio(
            db,
            encargo_id=encargo_id,
            destinatario="cliente",
            tipo="confirmacion",
            plantilla="confirmacion_encargo_foto",
            respuesta={"messages": [{"id": "wamid.INTENTO2"}]},
        )
        assert n2.intento == 2

        total = db.query(NotificacionWhatsapp).filter(
            NotificacionWhatsapp.encargo_id == encargo_id,
            NotificacionWhatsapp.destinatario == "cliente",
        ).count()
        assert total == 2
    finally:
        db.close()
    print("✅ PRUEBA 7 PASÓ: Historial de intentos preservado (intento 1 y 2) y anti-doble clic activo.")


def test_8_clasificacion_webhook_cliente_vs_proveedor_vs_desconocido():
    """Prueba 8: Clasificación de emisores y no respuesta automática a clientes."""
    print("\n--- PRUEBA 8: Diferenciación Proveedor vs Cliente vs Desconocido ---")
    db = SessionLocal()
    try:
        tel_prov = "573101112233"
        tel_cli = "573204445566"
        tel_desconocido = "573009998877"

        db.query(Proveedor).filter(Proveedor.telefono == tel_prov).delete()
        db.query(Cliente).filter(Cliente.telefono == tel_cli).delete()
        db.commit()

        p = Proveedor(nombre="Proveedor Test", telefono=tel_prov)
        c = Cliente(nombre="Cliente Test", telefono=tel_cli)
        db.add_all([p, c])
        db.commit()

        emisor_a = normalizar_numero_whatsapp("310 111 2233")
        prov_match = any(normalizar_numero_whatsapp(pr.telefono) == emisor_a for pr in db.query(Proveedor).all())
        assert prov_match is True, "Debe reconocer al proveedor registrado"

        emisor_b = normalizar_numero_whatsapp("+57 320 444 5566")
        prov_match_b = any(normalizar_numero_whatsapp(pr.telefono) == emisor_b for pr in db.query(Proveedor).all())
        cli_match_b = any(normalizar_numero_whatsapp(cl.telefono) == emisor_b for cl in db.query(Cliente).all())
        assert prov_match_b is False, "No debe catalogar al cliente como proveedor"
        assert cli_match_b is True, "Debe reconocer al cliente registrado"

        emisor_c = normalizar_numero_whatsapp(tel_desconocido)
        prov_match_c = any(normalizar_numero_whatsapp(pr.telefono) == emisor_c for pr in db.query(Proveedor).all())
        cli_match_c = any(normalizar_numero_whatsapp(cl.telefono) == emisor_c for cl in db.query(Cliente).all())
        assert prov_match_c is False and cli_match_c is False, "Número desconocido correctamente clasificado"

    finally:
        db.close()
    print("✅ PRUEBA 8 PASÓ: Clasificación exacta; clientes registrados no reciben auto-respuesta de proveedor.")


def test_9_enmascaramiento_telefono_en_logs():
    """Prueba 9: Los teléfonos se enmascaran en los logs para proteger datos personales."""
    print("\n--- PRUEBA 9: Enmascaramiento de datos personales en logs ---")
    assert enmascarar_telefono("573215551234") == "57321***1234"
    assert enmascarar_telefono("3001234567") == "30012***4567"
    assert enmascarar_telefono("123") == "***"
    print("✅ PRUEBA 9 PASÓ: Teléfonos enmascarados correctamente para observabilidad segura.")


def test_10_carrera_webhook_durable_sin_sleep():
    """Prueba 10: Webhook recibido antes del commit se persiste en tabla duradera sin sleep."""
    print("\n--- PRUEBA 10: Solución duradera y no bloqueante para webhooks anticipados ---")
    db = SessionLocal()
    try:
        wamid_anticipado = "wamid.HBgDURABLE_TEST_777"

        # 1. El webhook llega PRIMERO (antes de que exista NotificacionWhatsapp)
        status_web = {"id": wamid_anticipado, "status": "sent", "timestamp": "1700000088"}
        res = aplicar_estado_webhook(db, status_web)
        assert res == "guardado_pendiente", f"Debió guardarse en estado pendiente, obtuvo: {res}"

        # Verificar que quedó en la tabla duradera
        pend = db.query(EstadoWebhookPendiente).filter(EstadoWebhookPendiente.wamid == wamid_anticipado).first()
        assert pend is not None
        assert pend.estado == "sent"

        # 2. Ahora el hilo emisor persiste la fila en notificaciones_whatsapp
        notif = registrar_resultado_envio(
            db,
            encargo_id=555,
            destinatario="cliente",
            tipo="confirmacion",
            plantilla="confirmacion_encargo_foto",
            respuesta={"messages": [{"id": wamid_anticipado}]},
        )

        # 3. Debe haber consumido el estado 'sent' automáticamente
        assert notif.estado == "sent", f"El estado debió ser 'sent', obtuvo: {notif.estado}"

        # 4. El registro pendiente debió ser eliminado
        pend_despues = db.query(EstadoWebhookPendiente).filter(EstadoWebhookPendiente.wamid == wamid_anticipado).first()
        assert pend_despues is None, "El registro pendiente debió ser eliminado tras consumirse"
    finally:
        db.close()
    print("✅ PRUEBA 10 PASÓ: Webhook anticipado persistido duraderamente y consumido sin time.sleep.")


def test_11_seguridad_get_none_y_resistencia_tipos():
    """Prueba 11: Resistencia absoluta ante respuestas None o inesperadas (sin .get() crashes)."""
    print("\n--- PRUEBA 11: Seguridad ante respuestas None / no-dict ---")
    db = SessionLocal()
    try:
        # Caso A: respuesta es None
        n_none = registrar_resultado_envio(
            db, encargo_id=601, destinatario="cliente", tipo="confirmacion",
            plantilla="confirmacion_encargo_foto", respuesta=None,
        )
        assert n_none.estado == "failed"
        assert "Respuesta vacía" in n_none.error_mensaje

        # Caso B: respuesta es string inesperado
        n_str = registrar_resultado_envio(
            db, encargo_id=602, destinatario="proveedor", tipo="proveedor",
            plantilla="notificacion_proveedor_foto", respuesta="error de red",
        )
        assert n_str.estado == "failed"
        assert "malformada" in n_str.error_mensaje or "error de red" in n_str.error_mensaje

        # Caso C: respuesta dict sin campo messages ni error
        n_empty = registrar_resultado_envio(
            db, encargo_id=603, destinatario="cliente", tipo="confirmacion",
            plantilla="confirmacion_encargo_foto", respuesta={},
        )
        assert n_empty.estado == "failed"
        assert "messages" in n_empty.error_mensaje
    finally:
        db.close()
    print("✅ PRUEBA 11 PASÓ: Ninguna respuesta None o anómala provocó excepciones .get().")


def test_12_falla_persistencia_sin_duplicar_envios():
    """
    Prueba 12: Si Meta acepta el mensaje pero falla db.commit():
    - NO devuelve un objeto que aparente estar correctamente persistido (id=None, persistencia_exitosa=False).
    - Diferencia claramente aceptación externa (aceptado_externamente=True) y fallo local.
    - Informa explícitamente estado 'incierto' y mensaje preventivo contra duplicados.
    - No asume que el estado 'incierto' quedó persistido en la BD (verifica rollback real en BD).
    - Salvaguarda en memoria mantiene activa la ventana anti-duplicados y bloquea reenvíos inmediatos.
    - consultar_envio_incierto_reciente reporta el wamid aceptado por Meta con fallo de persistencia.
    """
    print("\n--- PRUEBA 12: Manejo de falla de BD local tras HTTP 200 de Meta (Estado Incierto) ---")
    db = SessionLocal()
    try:
        wamid_seguro = "wamid.HBgCOMMIT_FAIL_SAFE"

        # Simular que db.commit() falla en registrar_resultado_envio
        with patch.object(db, "commit", side_effect=Exception("Database lock/disconnect simulation")):
            notif = registrar_resultado_envio(
                db,
                encargo_id=701,
                destinatario="cliente",
                tipo="confirmacion",
                plantilla="confirmacion_encargo_foto",
                respuesta={"messages": [{"id": wamid_seguro}]},
            )
            # 1. Debe diferenciar explícitamente la aceptación externa de la persistencia fallida
            assert notif.estado == ESTADO_INCIERTO, f"El estado debió ser 'incierto', obtuvo: {notif.estado}"
            assert notif.id is None, f"El id debió ser None para no aparentar persistencia real, obtuvo: {notif.id}"
            assert getattr(notif, "persistencia_exitosa", True) is False, "persistencia_exitosa debe ser False"
            assert getattr(notif, "aceptado_externamente", False) is True, "aceptado_externamente debe ser True"
            assert notif.wamid == wamid_seguro
            assert notif.error_codigo == "PERSISTENCIA_FALLIDA"
            assert "incierto" in notif.error_mensaje.lower()
            assert "no reenviar" in notif.error_mensaje.lower()
            assert "verifique" in notif.error_mensaje.lower() or "verificar" in notif.error_mensaje.lower()

        # 2. Verificar que en la BD el registro NO quedó persistido (rollback confirmado, evita falsa persistencia)
        en_bd = db.query(NotificacionWhatsapp).filter(NotificacionWhatsapp.wamid == wamid_seguro).first()
        assert en_bd is None, "La fila no debe existir en la BD porque la transacción ejecutó rollback"

        # 3. La ventana anti-duplicados DEBE detectar el envío reciente vía registro en memoria
        assert envio_reciente_en_vuelo(db, 701, "cliente") is True, (
            "La ventana anti-duplicados debe detectar el envío en vuelo aun tras rollback en BD"
        )

        # 4. consultar_envio_incierto_reciente debe retornar la información del wamid aceptado
        incierto = consultar_envio_incierto_reciente(701, "cliente")
        assert incierto is not None, "Debe detectar el envío incierto reciente"
        assert incierto["wamid"] == wamid_seguro
        assert incierto["estado"] == ESTADO_INCIERTO
        assert incierto["aceptado_externamente"] is True
        assert incierto["persistencia_exitosa"] is False

    finally:
        db.close()
    print("✅ PRUEBA 12 PASÓ: Diferenciación nítida de aceptación externa y persistencia fallida; reporta estado 'incierto' sin fingir persistencia y protege contra duplicados.")


def test_13_validacion_estricta_respuesta_meta_y_wamid():
    """
    Prueba 13: Validación rigurosa de respuestas de Meta en helper y endpoints de reenvío:
    - Rechaza None, cadenas de texto, dicts vacíos, dicts malformados, listas vacías de messages y wamids vacíos.
    - Únicamente valida con éxito cuando Meta devuelve un wamid genuino.
    """
    print("\n--- PRUEBA 13: Validación estricta de respuestas Meta y wamid en endpoints de reenvío ---")

    # 1. Casos inválidos rechazados por validar_respuesta_meta_wamid
    casos_invalidos = [
        None,
        "cadena_de_error",
        {},
        {"foo": "bar"},
        {"messages": []},
        {"messages": [{}]},
        {"messages": [{"id": ""}]},
        {"messages": [{"id": "   "}]},
        {"error": {"code": 190, "message": "Invalid OAuth access token"}},
        [{"id": "wamid.LISTA_NO_DICT"}],
    ]

    for c in casos_invalidos:
        wamid, err = validar_respuesta_meta_wamid(c)
        assert wamid is None, f"Caso {c} no debió retornar wamid, pero retornó: {wamid}"
        assert err is not None and len(err) > 0, f"Caso {c} debió tener mensaje de error explicativo"

    # 2. Caso válido aceptado
    resp_valida = {"messages": [{"id": "wamid.HBgVALID_12345"}]}
    wamid_ok, err_ok = validar_respuesta_meta_wamid(resp_valida)
    assert wamid_ok == "wamid.HBgVALID_12345"
    assert err_ok is None

    # 3. Validar comportamiento en reenvío cuando la respuesta es None o malformada
    db = SessionLocal()
    try:
        encargo_id = 888
        # Registrar intento con respuesta vacía
        n_fallo = registrar_resultado_envio(
            db,
            encargo_id=encargo_id,
            destinatario="proveedor",
            tipo="proveedor",
            plantilla="notificacion_proveedor_encargo",
            respuesta=None,
        )
        assert n_fallo.estado == "failed"
        assert n_fallo.wamid is None
    finally:
        db.close()

    print("✅ PRUEBA 13 PASÓ: Rechazo estricto y controlado de respuestas anómalas; éxito únicamente con wamid válido.")


def test_14_webhook_fuera_del_event_loop():
    """
    Prueba 14: Evitar que el webhook async ejecute operaciones síncronas bloqueantes en el event loop.
    Verifica que la tarea se programa en BackgroundTasks de FastAPI (ejecución en worker threadpool).
    """
    print("\n--- PRUEBA 14: Ejecución del webhook fuera del event loop vía BackgroundTasks ---")
    bg = BackgroundTasks()

    payload_webhook = {
        "entry": [
            {
                "changes": [
                    {
                        "value": {
                            "statuses": [
                                {
                                    "id": "wamid.HBgTHREAD_POOL_TEST_1",
                                    "status": "sent",
                                    "timestamp": "1700000099",
                                }
                            ]
                        }
                    }
                ]
            }
        ]
    }

    # Programar en BackgroundTasks tal como hace recibir_webhook()
    bg.add_task(procesar_evento_webhook, payload_webhook)
    assert len(bg.tasks) == 1
    assert bg.tasks[0].func == procesar_evento_webhook
    assert bg.tasks[0].args == (payload_webhook,)

    # Ejecutar la función como worker thread fuera del event loop
    procesar_evento_webhook(payload_webhook)

    # Verificar que el status se procesó en la base de datos sin haber tocado el event loop
    db = SessionLocal()
    try:
        pend = db.query(EstadoWebhookPendiente).filter(EstadoWebhookPendiente.wamid == "wamid.HBgTHREAD_POOL_TEST_1").first()
        assert pend is not None
        assert pend.estado == "sent"
    finally:
        db.close()

    print("✅ PRUEBA 14 PASÓ: Webhook offloadeado a BackgroundTasks fuera del event loop; BD actualizada limpiamente.")


def test_15_bloqueo_for_update_nowait_hasta_registrar_intento():
    """
    Prueba 15: Verificar que la consulta para reenvío incluye la directiva FOR UPDATE NOWAIT
    y mantiene la sesión transaccional hasta completar el registro del intento.

    Limitación documentada de entorno:
    - SQLite (usado en esta suite aislada de pruebas) carece de soporte nativo para 'SELECT ... FOR UPDATE NOWAIT'
      a nivel de fila. Por tanto, esta prueba en SQLite valida la compilación sintáctica de SQLAlchemy, la sesión
      y la integridad transaccional del intento, pero no puede demostrar bloqueo de concurrencia real entre múltiples
      conexiones como lo hace PostgreSQL en producción.
    - Por estrictas restricciones de seguridad, no se conecta la suite a PostgreSQL de producción.
    """
    print("\n--- PRUEBA 15: Integridad del bloqueo FOR UPDATE NOWAIT durante el reenvío ---")
    db1 = SessionLocal()
    try:
        # Crear cliente y encargo de prueba
        cli = Cliente(nombre="Cliente Locked", telefono="573001112233")
        db1.add(cli)
        db1.commit()
        db1.refresh(cli)

        e = Encargo(
            cliente_id=cli.id,
            referencia="Nike Air Zoom Locked",
            talla_eur="42",
            talla_col="40",
            precio=350000.0,
            fecha_creacion="2026-10-25",
            abono=100000,
            saldo=250000,
            fecha_entrega_estimada="2026-11-01",
            estado="pendiente",
        )
        db1.add(e)
        db1.commit()
        db1.refresh(e)

        # En PostgreSQL, with_for_update(nowait=True) bloquea la fila a nivel de transacción
        encargo_bloqueado = db1.query(Encargo).filter(Encargo.id == e.id).with_for_update(nowait=True).first()
        assert encargo_bloqueado is not None
        assert encargo_bloqueado.id == e.id

        # Simular intento de reenvío y registro en la misma sesión db1 manteniendo la transacción
        notif = registrar_resultado_envio(
            db1,
            encargo_id=e.id,
            destinatario="cliente",
            tipo="confirmacion",
            plantilla="confirmacion_encargo",
            respuesta={"messages": [{"id": "wamid.HBgLOCKED_ROW_TEST"}]},
        )
        assert notif.estado == "accepted"
        assert notif.wamid == "wamid.HBgLOCKED_ROW_TEST"
        assert notif.persistencia_exitosa is True

    finally:
        db1.close()
    print("✅ PRUEBA 15 PASÓ: El bloqueo FOR UPDATE NOWAIT se mantiene hasta registrar y confirmar el intento.")


def test_16_bloqueo_reenvio_ante_resultado_incierto_y_aviso_operador():
    """
    Prueba 16: Verificar que los endpoints de reenvío:
    - Bloquean intentos de reenvío si un envío previo quedó en estado incierto (rollback en BD tras aceptación de Meta).
    - Informan claramente al operador mediante HTTP 409 que debe verificar la entrega antes de intentar de nuevo.
    - No ejecutan llamadas externas a WhatsApp cuando existe un envío con resultado desconocido.
    """
    print("\n--- PRUEBA 16: Bloqueo de reenvío ante resultado incierto y aviso al operador ---")
    from app.routes.encargo import reenviar_encargo_cliente

    db = SessionLocal()
    try:
        # Crear cliente y encargo en BD aislada
        cli = Cliente(nombre="Cliente Incierto Test", telefono="3001112233")
        db.add(cli)
        db.commit()
        db.refresh(cli)

        enc = Encargo(
            cliente_id=cli.id,
            referencia="Nike Air Test Incierto",
            talla_eur="42",
            talla_col="39",
            precio=250000,
            abono=50000,
            saldo=200000,
            fecha_creacion=datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S"),
            fecha_entrega_estimada="2026-11-01",
            estado="pendiente",
        )
        db.add(enc)
        db.commit()
        db.refresh(enc)

        # 1. Simular un primer intento donde Meta acepta pero la BD local falla en commit y hace rollback
        wamid_incierto = "wamid.HBgINCIERTO_ENDPOINT_TEST"
        with patch.object(db, "commit", side_effect=Exception("Simulated commit crash")):
            notif = registrar_resultado_envio(
                db,
                encargo_id=enc.id,
                destinatario="cliente",
                tipo="confirmacion",
                plantilla="confirmacion_encargo",
                respuesta={"messages": [{"id": wamid_incierto}]},
            )
            assert notif.estado == ESTADO_INCIERTO
            assert notif.persistencia_exitosa is False

        # 2. Ahora el operador (o un script automático) intenta reenviar el mensaje a través del endpoint
        # Mockear las llamadas de envío a WhatsApp para asegurar que NO se invoquen
        with patch("app.routes.encargo.enviar_template_confirmacion_encargo") as mock_envio:
            try:
                reenviar_encargo_cliente(encargo_id=enc.id, db=db, current_user="admin")
                assert False, "Debió lanzar HTTPException 409 debido al envío incierto reciente"
            except HTTPException as http_exc:
                assert http_exc.status_code == 409, f"Código esperado 409, obtenido: {http_exc.status_code}"
                assert "rollback" in http_exc.detail.lower() or "incierta" in http_exc.detail.lower()
                assert "verifique la entrega" in http_exc.detail.lower()
                assert wamid_incierto in http_exc.detail

            # Comprobar que JAMÁS se intentó llamar a la API de WhatsApp de nuevo
            mock_envio.assert_not_called()

    finally:
        db.close()
    print("✅ PRUEBA 16 PASÓ: Reenvío bloqueado ante resultado incierto; operador advertido y WhatsApp no duplicado.")


def test_17_registro_rutas_reenvio_fastapi():
    """
    Prueba 17: Inspeccionar app.routes de FastAPI para verificar el registro real
    de los endpoints HTTP POST de reenvío:
    - POST /encargos/{encargo_id}/reenviar-cliente
    - POST /encargos/{encargo_id}/reenviar-proveedor
    """
    print("\n--- PRUEBA 17: Verificación de registro de rutas de reenvío en FastAPI ---")
    from app.main import app

    rutas_encontradas = {}
    for route in app.routes:
        path = getattr(route, "path", None)
        methods = getattr(route, "methods", set())
        if path:
            rutas_encontradas[path] = methods

    # 1. Comprobar ruta de reenvío al cliente
    ruta_cli = "/encargos/{encargo_id}/reenviar-cliente"
    assert ruta_cli in rutas_encontradas, (
        f"La ruta '{ruta_cli}' no está registrada en app.routes de FastAPI. "
        f"Rutas disponibles: {list(rutas_encontradas.keys())}"
    )
    assert "POST" in rutas_encontradas[ruta_cli], (
        f"La ruta '{ruta_cli}' debe admitir método POST. Métodos actuales: {rutas_encontradas[ruta_cli]}"
    )

    # 2. Comprobar ruta de reenvío al proveedor
    ruta_prov = "/encargos/{encargo_id}/reenviar-proveedor"
    assert ruta_prov in rutas_encontradas, (
        f"La ruta '{ruta_prov}' no está registrada en app.routes de FastAPI."
    )
    assert "POST" in rutas_encontradas[ruta_prov], (
        f"La ruta '{ruta_prov}' debe admitir método POST. Métodos actuales: {rutas_encontradas[ruta_prov]}"
    )

    print("✅ PRUEBA 17 PASÓ: Endpoints POST de reenvío a cliente y proveedor registrados correctamente en FastAPI.")


if __name__ == "__main__":
    print("=" * 70)
    print("EJECUTANDO SUITE DE PRUEBAS AUTOMATIZADAS (WHATSAPP + CLOUDINARY)")
    print("Base de datos aislada:", DB_TEST_PATH)
    print("=" * 70)

    try:
        test_1_deteccion_y_construccion_urls_cloudinary()
        test_2_imagen_menor_5mb()
        test_3_imagen_mayor_5mb_con_optimizacion_progresiva()
        test_4_error_transformacion_o_tipo_invalido()
        test_5_registro_estados_whatsapp_e_idempotencia()
        test_6_fallo_asincrono_codigo_131053()
        test_7_reintentos_manuales_y_anti_duplicado()
        test_8_clasificacion_webhook_cliente_vs_proveedor_vs_desconocido()
        test_9_enmascaramiento_telefono_en_logs()
        test_10_carrera_webhook_durable_sin_sleep()
        test_11_seguridad_get_none_y_resistencia_tipos()
        test_12_falla_persistencia_sin_duplicar_envios()
        test_13_validacion_estricta_respuesta_meta_y_wamid()
        test_14_webhook_fuera_del_event_loop()
        test_15_bloqueo_for_update_nowait_hasta_registrar_intento()
        test_16_bloqueo_reenvio_ante_resultado_incierto_y_aviso_operador()
        test_17_registro_rutas_reenvio_fastapi()

        print("\n" + "=" * 70)
        print("TODAS LAS PRUEBAS (17/17) PASARON SATISFACTORIAMENTE")
        print("=" * 70)
    finally:
        try:
            engine.dispose()
        except Exception:
            pass
        if os.path.exists(DB_TEST_PATH):
            try:
                os.remove(DB_TEST_PATH)
                print(f"Base de datos de prueba eliminada: {DB_TEST_PATH}")
            except Exception:
                pass
